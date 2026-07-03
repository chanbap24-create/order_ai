/**
 * 추천견적 공식 백테스트 (CDV · 신규제안 모드)
 * ------------------------------------------------------------------
 * 질문: "과거 컷오프일 T 시점에 현행 공식으로 추천했다면, 그 거래처가
 *        [T, T+H]에 실제로 새로 산 와인을 상위에 잘 올렸는가?"
 *
 * 방식(leakage-free 재구성):
 *  - T 이전 출고( [T-profileMonths, T) )로만 취향 프로필 생성
 *  - scoreRecommendations(현행 신규제안 공식)를 그대로 재사용해 순위 산출
 *  - 정답 = [T, T+H]에 처음 산(=T 이전 미구매) 품목 ∩ 후보 유니버스
 *  - 지표: hit@k · precision@k · recall@k (k=10/20/30), 거래처 매크로 평균
 *  - 베이스라인: 인기순(avg_sales_90d, 비개인화) · 랜덤(해석적 기대값)
 *
 * v1 한계(정직하게):
 *  - 재고는 과거 스냅샷이 없어 '현재 in-stock'을 후보 유니버스로 사용
 *    → 절대 recall은 하한. 단, 모든 방법이 동일 유니버스라 '상대 lift'는 유효.
 *  - 견적학습(quoteFeedback)·전환맵은 as-of-T 재구성 필요 → v1에서 끔(코어 공식만 평가). v2 후속.
 *  - velocity(avg_sales_90d)는 현재값이라 미세 leakage 있으나 가중치 2/100로 무시.
 *  - CDV 전용(inventory_cdv/shipments). DL은 glass 별도 테이블 → 별도 스크립트.
 *
 * 사용법:
 *   npx -y tsx scripts/recommend-backtest.ts
 *   ... --cutoff 2025-12-01 --horizon 60 --profile-months 6 --min-history 3 --limit 100
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const { supabase } = await import('@/app/lib/db');
  const { fetchInventoryInStock, fetchWinesByCodes, fetchAll } = await import('@/app/api/sales/recommend/lib/fetchers');
  const { extractGrapesFromName, extractTypeFromName } = await import('@/app/api/sales/recommend/lib/patterns');
  const { findHierarchy } = await import('@/app/api/sales/recommend/lib/regions');
  const { makeMinStockForPrice, DEFAULT_REC_OPTS } = await import('@/app/api/sales/recommend/lib/settings');
  const { aggregatePurchases, buildClientPreferences } = await import('@/app/api/sales/recommend/lib/preferences');
  const { scoreRecommendations, DEFAULT_SCORE_PARAMS } = await import('@/app/api/sales/recommend/lib/scoring');
  const { isNonOrderable } = await import('@/app/lib/catalogFilter');
  const { isNonStandardBottle, isGiftBox } = await import('@/app/api/sales/recommend/lib/bottleSize');
  const { blendPopularity } = await import('@/app/api/sales/recommend/lib/popularityBlend'); // 프로덕션 블렌드 함수(검증 대상)
  const { VENUE_WINE_MAP } = await import('@/app/api/sales/recommend/lib/venueScoring');
  type WineRegionRow = Awaited<ReturnType<typeof findHierarchy>> extends any ? any : any;

  // ---- CLI ----
  const argv = process.argv.slice(2);
  const arg = (k: string, def: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const cutoff = arg('cutoff', daysAgo(180));           // T
  const horizon = Number(arg('horizon', '60'));          // H (일)
  const profileMonths = Number(arg('profile-months', '6'));
  const minHistory = Number(arg('min-history', '3'));    // T 이전 최소 구매 품목 수
  const limit = Number(arg('limit', '0'));               // 거래처 상한(0=전체)
  const blend = argv.includes('--blend');                // 인기(breadth) prior 블렌드 α-스윕
  const venueMode = argv.includes('--venue');            // 업장 A/B: 옛(지역46·업장0) vs 현행(지역36·업장20)
  const ALPHAS = [0.3, 0.5, 0.7];                        // 최종 = (1-α)·개인화 + α·구매폭백분위
  const o = { ...DEFAULT_REC_OPTS };
  // 게이트 민감도 실험용 오버라이드(기본=라이브 default)
  o.geoCeiling = (['super', 'country', 'any'].includes(arg('geo', '')) ? arg('geo', '') : o.geoCeiling) as typeof o.geoCeiling;
  { const b = Number(arg('band', '')); if (Number.isFinite(b) && b > 0) o.priceBandPct = b; }

  const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
  const addMonths = (d: string, m: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };
  const trainFrom = addMonths(cutoff, -profileMonths);   // [T-profileMonths, T)
  const postTo = addDays(cutoff, horizon);               // [T, T+H]

  console.log(`\n[백테스트] CDV · 신규제안 코어공식`);
  console.log(`  컷오프 T=${cutoff} · 학습창=[${trainFrom}, ${cutoff}) · 정답창=[${cutoff}, ${postTo}] · 최소이력=${minHistory}${limit ? ` · 거래처상한=${limit}` : ''}`);
  console.log(`  게이트: 지역천장=${o.geoCeiling} · 가격밴드=±${Math.round(o.priceBandPct * 100)}% · 빈도강도=${o.freqStrength}\n`);

  // ---- 1) 글로벌: 재고 유니버스 + wineMap (buildCandidates와 동일 구성) ----
  const [rawInventory, regionRows, allNotes] = await Promise.all([
    fetchInventoryInStock<Record<string, any>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, bonded_kctc, sales_30days, avg_sales_90d'),
    fetchAll<WineRegionRow>('wine_regions', 'country, sub_region, major_region, appellation, cru_vineyard, classification'),
    fetchAll<{ wine_id: string; nose_note?: string; palate_note?: string }>('tasting_notes', 'wine_id, nose_note, palate_note'),
  ]);
  const notesMap = new Map<string, string>();
  for (const n of allNotes) notesMap.set(n.wine_id, `${n.nose_note || ''} ${n.palate_note || ''}`.trim());

  const minStockForPrice = makeMinStockForPrice(o.minStock);
  const inventory = (rawInventory || []).filter((inv: any) => {
    if (isNonOrderable(inv.item_no, inv.item_name, 'CDV')) return false;
    if (isNonStandardBottle(inv.item_name)) return false;
    if (isGiftBox(inv.item_name)) return false;
    const stock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0) + (inv.bonded_kctc || 0);
    if (stock <= 0 || stock < minStockForPrice(inv.supply_price || 0)) return false;
    const monthly = inv.sales_30days || 0;
    if (monthly > 0 && stock < monthly * o.stockMonths) return false;
    inv._totalStock = stock;
    return true;
  });
  const inventoryMap = new Map<string, any>();
  for (const inv of inventory) inventoryMap.set(inv.item_no, inv);

  const wines = await fetchWinesByCodes<Record<string, any>>(
    inventory.map((i: any) => i.item_no),
    'item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr, item_name_en, image_url, brand, supplier, supply_price',
  );
  const wineMap = new Map<string, any>();
  for (const w of wines) {
    if (!w.grape_varieties) { const g = extractGrapesFromName(w.item_name_kr || ''); if (g.length) w.grape_varieties = g.join(', '); }
    if (!w.wine_type) w.wine_type = extractTypeFromName(w.item_name_kr || '');
    w._hierarchy = findHierarchy(w.region || '', `${w.item_name_kr || ''} ${w.item_name_en || ''}`, regionRows as any, w.country_en || w.country || '');
    w._notes = notesMap.get(w.item_code) || '';
    wineMap.set(w.item_code, w);
  }
  const universe = new Set(inventory.map((i: any) => i.item_no));
  console.log(`  유니버스(추천 대상 재고): ${universe.size}개 · 지역마스터 ${regionRows.length} · 노트 ${allNotes.length}`);

  // 모델 velocity 항은 avg_sales_90d(=오늘 기준, 컷오프 이후 leakage) → 0으로 끔.
  const scoreParams = { ...DEFAULT_SCORE_PARAMS, velocityWeight: 0 };

  // ---- 2) 윈도 출고 벌크 로드 → 거래처별 그룹 ----
  type Ship = { client_code: string; item_no: string; item_name?: string; unit_price?: number; quantity?: number; ship_date: string };
  const byClient = new Map<string, { pre: Ship[]; post: Set<string> }>();
  const preBuyers = new Map<string, Set<string>>(); // 유니버스 품목별 컷오프 이전 구매 거래처(폭) — leakage-free 인기 베이스라인
  {
    const PAGE = 1000; let from = 0; let total = 0;
    while (true) {
      const { data, error } = await supabase
        .from('shipments')
        .select('client_code, item_no, item_name, unit_price, quantity, ship_date')
        .gte('ship_date', trainFrom).lte('ship_date', postTo)
        .range(from, from + PAGE - 1);
      if (error) { console.error('shipments 조회 오류:', error.message); break; }
      if (!data || data.length === 0) break;
      for (const s of data as Ship[]) {
        if (!s.client_code || !s.item_no || !s.ship_date) continue;
        let e = byClient.get(s.client_code);
        if (!e) { e = { pre: [], post: new Set() }; byClient.set(s.client_code, e); }
        if (s.ship_date < cutoff) {
          e.pre.push(s);
          if (universe.has(s.item_no)) {
            let bs = preBuyers.get(s.item_no); if (!bs) { bs = new Set(); preBuyers.set(s.item_no, bs); }
            bs.add(s.client_code);
          }
        } else e.post.add(s.item_no);
      }
      total += data.length;
      if (data.length < PAGE) break;
      from += PAGE;
    }
    console.log(`  윈도 출고: ${total}행 · 활동 거래처 ${byClient.size}곳\n`);
  }

  // 인기순 베이스라인(비개인화·leakage-free): 컷오프 이전 구매 폭(거래처 수) 내림차순
  const bestsellerRank = [...universe].sort((a, b) => (preBuyers.get(b)?.size || 0) - (preBuyers.get(a)?.size || 0));

  // 구매폭 백분위(0~1, leakage-free): 블렌드 prior용. 자기보다 폭 작은 품목 비율.
  const breadthPct = new Map<string, number>();
  {
    const arr = [...universe].map((c) => ({ c, n: preBuyers.get(c)?.size || 0 }));
    const denom = Math.max(1, arr.length - 1);
    for (const { c, n } of arr) breadthPct.set(c, arr.filter((x) => x.n < n).length / denom);
  }

  // ---- 3) 거래처 루프: 점수화 + 지표 ----
  const KS = [10, 20, 30];
  const mkBuckets = () => KS.map(() => ({ hit: 0, precision: 0, recall: 0 }));
  const agg = {
    model: mkBuckets(),
    best: mkBuckets(),
    blend: ALPHAS.map(() => mkBuckets()),  // 풀-내 블렌드(게이트 통과분만)
    blendU: ALPHAS.map(() => mkBuckets()), // 전체유니버스 블렌드(게이트밖 인기품목 포함)
    randPrecision: KS.map(() => 0), randRecall: KS.map(() => 0),
    aOld: mkBuckets(), aNew: mkBuckets(), // 업장 A/B
  };
  let evaluated = 0, sumUniverse = 0, sumPositives = 0, sumCandidates = 0, venEval = 0;

  // 업장 A/B 점수설정: 옛(지역46·견적44·업장0) vs 현행(지역36·업장20). 둘 다 velocity/견적학습 off(leakage).
  const SP_NEW = scoreParams; // 이미 36/29/23/16 · venueWeight 20 · velocity 0
  const SP_OLD = { ...scoreParams, tierBase: [46, 37, 29, 21] as [number, number, number, number], quoteFeedbackWeight: 44, venueWeight: 0 };
  const cvRows = (await supabase.from('client_venue').select('client_code, venue').eq('client_type', 'wine')).data || [];
  const venueOf = new Map<string, string>();
  for (const r of cvRows as any[]) venueOf.set(String(r.client_code), r.venue);

  // 정답/랭킹으로 지표 누적
  const scoreRankMetrics = (rankedCodes: string[], positives: Set<string>, bucket: { hit: number; precision: number; recall: number }[]) => {
    KS.forEach((k, ki) => {
      const topk = rankedCodes.slice(0, k);
      let hits = 0; for (const c of topk) if (positives.has(c)) hits++;
      bucket[ki].hit += hits > 0 ? 1 : 0;
      bucket[ki].precision += hits / k;
      bucket[ki].recall += positives.size ? hits / positives.size : 0;
    });
  };

  for (const [code, e] of byClient.entries()) {
    if (limit && evaluated >= limit) break;
    // 정답: [T,T+H]에 산 것 중 T 이전 미구매(신규) & 유니버스 내
    const preItems = new Set(e.pre.map((s) => s.item_no));
    const positives = new Set<string>();
    for (const c of e.post) if (!preItems.has(c) && universe.has(c)) positives.add(c);
    if (preItems.size < minHistory || positives.size === 0) continue;

    const purchaseAgg = aggregatePurchases(e.pre as any);
    const prefs = buildClientPreferences(purchaseAgg, wineMap, inventoryMap);
    if (!prefs.hasHistory) continue;

    // 업장 A/B 모드: 태깅된 거래처만. 옛(46·업장0) vs 현행(36·업장20) 랭킹 비교.
    if (venueMode) {
      const venue = venueOf.get(code);
      if (!venue) continue;
      const venuePref = VENUE_WINE_MAP[venue] || null;
      const core = { inventory, wineMap, purchaseAgg, prefs, priceBandPct: o.priceBandPct, geoCeiling: o.geoCeiling, freqStrength: o.freqStrength, maxSales90d: 1, mode: 'new' as const };
      const rankA = scoreRecommendations({ ...core, scoreParams: SP_OLD }).map((s) => s.item_no);
      const rankB = scoreRecommendations({ ...core, scoreParams: SP_NEW, venuePref }).map((s) => s.item_no);
      scoreRankMetrics(rankA, positives, agg.aOld);
      scoreRankMetrics(rankB, positives, agg.aNew);
      venEval++;
      continue;
    }

    const scored = scoreRecommendations({
      inventory, wineMap, purchaseAgg, prefs,
      priceBandPct: o.priceBandPct, geoCeiling: o.geoCeiling, freqStrength: o.freqStrength,
      maxSales90d: 1, scoreParams, mode: 'new',
      // v1: 견적학습·전환·최근제안 끔(as-of-T 재구성 필요 → 코어 공식만 평가). velocity도 0(위 scoreParams).
    });
    const modelRank = scored.map((s) => s.item_no);
    sumCandidates += scored.length;

    scoreRankMetrics(modelRank, positives, agg.model);
    scoreRankMetrics(bestsellerRank, positives, agg.best);

    // 인기 prior 블렌드: 개인화 점수를 후보 내 min-max로 [0,1] 정규화 후 구매폭백분위와 혼합
    if (blend && scored.length) {
      let lo = Infinity, hi = -Infinity;
      for (const s of scored) { if (s.score < lo) lo = s.score; if (s.score > hi) hi = s.score; }
      const span = hi - lo;
      // 개인화 정규화 점수 맵(풀-내 블렌드 비교용)
      const persNormMap = new Map<string, number>();
      for (const s of scored) persNormMap.set(s.item_no, span > 0 ? (s.score - lo) / span : 1);
      ALPHAS.forEach((a, ai) => {
        // (P) 풀-내 블렌드: 게이트 통과 후보만 대상
        const rankP = [...scored]
          .map((s) => ({ c: s.item_no, v: (1 - a) * (persNormMap.get(s.item_no) || 0) + a * (breadthPct.get(s.item_no) || 0) }))
          .sort((x, y) => y.v - x.v).map((x) => x.c);
        scoreRankMetrics(rankP, positives, agg.blend[ai]);
        // (U) 전체유니버스 블렌드 = 프로덕션 blendPopularity 함수 그대로 호출(leakage-free breadth 주입)
        const rankU = blendPopularity(scored, inventory, wineMap, breadthPct, a).map((s) => s.item_no);
        scoreRankMetrics(rankU, positives, agg.blendU[ai]);
      });
    }
    // 랜덤 기대값(해석적): precision@k ≈ P/U, recall@k ≈ k/U
    KS.forEach((k, ki) => { agg.randPrecision[ki] += positives.size / universe.size; agg.randRecall[ki] += Math.min(1, k / universe.size); });

    evaluated++; sumUniverse += universe.size; sumPositives += positives.size;
  }

  // ---- 4) 출력 ----
  if (venueMode) {
    if (venEval === 0) { console.log('업장 태깅된 평가 거래처 0곳.'); return; }
    const vp = (x: number) => (100 * x / venEval).toFixed(1);
    const vrow = (label: string, m: { hit: number; precision: number; recall: number }[]) =>
      `  ${label.padEnd(16)} ` + KS.map((k, ki) => `k=${k}: hit ${vp(m[ki].hit)}%  P ${vp(m[ki].precision)}%  R ${vp(m[ki].recall)}%`).join('   |  ');
    console.log(`[업장 A/B] 태깅 거래처 ${venEval}곳 (견적학습·velocity off — 측정가능=지역tier축소+업장추가)\n`);
    console.log(vrow('A 옛(지역46,업장0)', agg.aOld));
    console.log(vrow('B 현행(지역36,업장20)', agg.aNew));
    const dHit = (agg.aNew[0].hit - agg.aOld[0].hit) / Math.max(1, venEval) * 100;
    console.log(`\n  ▶ hit@10 변화(B−A) = ${dHit >= 0 ? '+' : ''}${dHit.toFixed(1)}%p`);
    return;
  }
  if (evaluated === 0) { console.log('평가 대상 거래처 0곳 — 컷오프/최소이력 조건을 완화해 보세요.'); return; }
  const pct = (x: number) => (100 * x / evaluated).toFixed(1);
  const row = (label: string, m: { hit: number; precision: number; recall: number }[]) =>
    `  ${label.padEnd(12)} ` + KS.map((k, ki) => `k=${k}: hit ${pct(m[ki].hit)}%  P ${pct(m[ki].precision)}%  R ${pct(m[ki].recall)}%`).join('   |  ');

  console.log(`평가 거래처: ${evaluated}곳 · 평균 정답 ${(sumPositives / evaluated).toFixed(1)}개 · 유니버스 ${Math.round(sumUniverse / evaluated)}개 · 모델 게이트통과 평균 ${(sumCandidates / evaluated).toFixed(0)}개`);
  console.log(`(hit=상위k에 정답 1개+ 포함 거래처 비율 · P=precision@k · R=recall@k, 모두 거래처 매크로평균)\n`);
  console.log(row('현행공식', agg.model));
  if (blend) {
    ALPHAS.forEach((a, ai) => console.log(row(`풀블렌드${a}`, agg.blend[ai])));
    ALPHAS.forEach((a, ai) => console.log(row(`전체블렌드${a}`, agg.blendU[ai])));
  }
  console.log(row('인기순', agg.best));
  console.log(`  ${'랜덤(기대)'.padEnd(12)} ` + KS.map((k, ki) => `k=${k}: hit  -    P ${pct(agg.randPrecision[ki])}%  R ${pct(agg.randRecall[ki])}%`).join('   |  '));

  // lift 요약(현행 vs 인기순, precision@10 기준)
  const liftP10 = agg.best[0].precision > 0 ? agg.model[0].precision / agg.best[0].precision : 0;
  console.log(`\n  ▶ precision@10 lift(현행/인기순) = ${liftP10.toFixed(2)}x · 현행 hit@10 = ${pct(agg.model[0].hit)}%`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('BACKTEST FAIL:', e); process.exit(1); });
