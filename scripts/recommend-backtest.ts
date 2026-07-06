/**
 * 추천견적 공식 백테스트 (CDV · 신규제안 · 세그먼트 포함)
 * ------------------------------------------------------------------
 * 질문: "과거 컷오프일 T 시점에 현행 공식으로 추천했다면, 그 거래처가
 *        [T, T+H]에 실제로 새로 산 와인을 상위에 잘 올렸는가?"
 *        + "세그먼트 배점(특히 지역 20점)을 바꾸면 적중이 오르나?"
 *
 * 방식(leakage-free 재구성):
 *  - T 이전 출고([T-profileMonths, T))로만 취향 프로필·typeShares 생성
 *  - scoreRecommendations(현행 신규제안 공식)를 그대로 재사용 — 세그먼트 축 포함
 *  - 정답 = [T, T+H]에 처음 산(=T 이전 미구매) 품목 ∩ 후보 유니버스
 *  - 지표: hit@k · precision@k · recall@k (k=10/20/30), 거래처 매크로 평균
 *  - 배점 변형(segPts)을 스윕해 현행 vs 지역↓/제거/업태↑ 등을 비교
 *
 * 한계(정직하게):
 *  - 재고는 과거 스냅샷이 없어 '현재 in-stock'을 후보 유니버스로 사용 → 절대 recall은 하한.
 *    단 모든 변형이 동일 유니버스라 '상대 lift'는 유효.
 *  - 세그먼트 프로필(segment_profiles)은 현재값(글로벌 집계) → 약한 leakage.
 *    단 집계라 안정적이고 모든 변형에 동일 적용 → 변형 간 상대 비교엔 무해.
 *  - 견적학습(quoteFeedback)·전환·최근제안은 as-of-T 재구성 필요 → 끔(코어+세그먼트만).
 *  - CDV 전용(inventory_cdv/shipments).
 *
 * 사용법:
 *   npx -y tsx scripts/recommend-backtest.ts
 *   ... --cutoff 2025-12-01 --horizon 60 --profile-months 6 --min-history 3 --limit 200
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
  type SegRank = { typeRank: Map<string, number>; countryRank: Map<string, number> };
  const { normalizeType, bucketLabel } = await import('@/app/api/sales/recommend/lib/wineType');
  const { extractRegion } = await import('@/app/lib/segmentProfiles');
  const { isNonOrderable } = await import('@/app/lib/catalogFilter');
  const { isNonStandardBottle, isGiftBox } = await import('@/app/api/sales/recommend/lib/bottleSize');
  const { getClientQuoteFeatures } = await import('@/app/api/sales/recommend/lib/quoteFeedback');
  const { getClientConversion } = await import('@/app/lib/quoteConversion');
  type WineRegionRow = any;

  // ---- CLI ----
  const argv = process.argv.slice(2);
  const arg = (k: string, def: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const cutoff = arg('cutoff', daysAgo(180));
  const horizon = Number(arg('horizon', '60'));
  const profileMonths = Number(arg('profile-months', '6'));
  const minHistory = Number(arg('min-history', '3'));
  const limit = Number(arg('limit', '0'));
  const o = { ...DEFAULT_REC_OPTS };
  o.geoCeiling = (['super', 'country', 'any'].includes(arg('geo', '')) ? arg('geo', '') : o.geoCeiling) as typeof o.geoCeiling;
  { const b = Number(arg('band', '')); if (Number.isFinite(b) && b > 0) o.priceBandPct = b; }

  const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
  const addMonths = (d: string, m: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };
  const trainFrom = addMonths(cutoff, -profileMonths);
  const postTo = addDays(cutoff, horizon);

  // ---- v2 변형: 개인화 신호(견적학습·과거거절)를 as-of-T로 켜서 기여 측정 ----
  //  QF = 견적학습(+15 속성 가산), CONV = 과거거절 감점(견적했는데 안 산 품목 −7/−14/−21)
  const VARIANTS: { name: string; useQF: boolean; useConv: boolean }[] = [
    { name: '코어(세그포함)', useQF: false, useConv: false },
    { name: '+견적학습', useQF: true, useConv: false },
    { name: '+과거거절', useQF: false, useConv: true },
    { name: 'FULL(둘다)', useQF: true, useConv: true },
  ];

  console.log(`\n[백테스트 v2] CDV · 신규제안(세그먼트 + 견적학습·전환 as-of-T)`);
  console.log(`  컷오프 T=${cutoff} · 학습창=[${trainFrom}, ${cutoff}) · 정답창=[${cutoff}, ${postTo}] · 최소이력=${minHistory}${limit ? ` · 상한=${limit}` : ''}`);
  console.log(`  게이트: 지역천장=${o.geoCeiling} · 가격밴드=±${Math.round(o.priceBandPct * 100)}%`);
  console.log(`  견적학습·과거거절은 T 이전 견적·출고만으로 재구성(leakage-free). 최근제안 페널티만 여전히 OFF.\n`);

  // ---- 1) 재고 유니버스 + wineMap ----
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
  console.log(`  유니버스(재고): ${universe.size}개 · 지역마스터 ${regionRows.length} · 노트 ${allNotes.length}`);

  // ---- 2) 세그먼트 사전: clients(업종·주소) + client_venue + segment_profiles 벌크 ----
  const clientOf = new Map<string, { business_type?: string; address?: string }>();
  { let from = 0; while (true) { // client_details(wine) 페이지네이션 — business_type·address 출처(clients엔 없음)
      const { data } = await supabase.from('client_details').select('client_code, business_type, address').eq('client_type', 'wine').range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const c of data as any[]) clientOf.set(String(c.client_code), { business_type: c.business_type, address: c.address });
      if (data.length < 1000) break; from += 1000;
  } }
  const [cvRes, segRes] = await Promise.all([
    supabase.from('client_venue').select('client_code, venue').eq('client_type', 'wine'),
    supabase.from('segment_profiles').select('segment_type, segment_key, type_dist, top_countries, price_median'),
  ]);
  const venueOf = new Map<string, string>();
  for (const r of (cvRes.data || []) as any[]) venueOf.set(String(r.client_code), r.venue);
  const segProf = new Map<string, any>();
  for (const p of (segRes.data || []) as any[]) segProf.set(`${p.segment_type}:${p.segment_key}`, p);

  const toSegRank = (p: any | null): SegRank | null => {
    if (!p) return null;
    const typeRank = new Map<string, number>();
    Object.entries(p.type_dist || {}).sort((a: any, b: any) => b[1] - a[1]).forEach(([t], i) => { if (t !== '기타') typeRank.set(t, i); });
    const countryRank = new Map<string, number>();
    (p.top_countries || []).forEach((c: any, i: number) => { if (c.country && c.country !== '기타') countryRank.set(c.country, i); });
    return { typeRank, countryRank };
  };

  // ---- 3) 윈도 출고 → 거래처별 pre/post ----
  type Ship = { client_code: string; item_no: string; item_name?: string; unit_price?: number; quantity?: number; ship_date: string };
  const byClient = new Map<string, { pre: Ship[]; post: Set<string> }>();
  const preBuyers = new Map<string, Set<string>>();
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
  const bestsellerRank = [...universe].sort((a, b) => (preBuyers.get(b)?.size || 0) - (preBuyers.get(a)?.size || 0));

  // ---- 4) 거래처 루프: 변형별 랭킹 + 지표 ----
  const KS = [10, 20, 30];
  const mkBuckets = () => KS.map(() => ({ hit: 0, precision: 0, recall: 0 }));
  const aggVar = VARIANTS.map(() => mkBuckets());
  const aggBest = mkBuckets();
  const randPrecision = KS.map(() => 0);
  let evaluated = 0, sumUniverse = 0, sumPositives = 0, segClients = 0, qfClients = 0;

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
    const preItems = new Set(e.pre.map((s) => s.item_no));
    const positives = new Set<string>();
    for (const c of e.post) if (!preItems.has(c) && universe.has(c)) positives.add(c);
    if (preItems.size < minHistory || positives.size === 0) continue;

    const purchaseAgg = aggregatePurchases(e.pre as any);
    const prefs = buildClientPreferences(purchaseAgg, wineMap, inventoryMap);
    if (!prefs.hasHistory) continue;

    // 세그먼트 구성(글로벌 프로필)
    const venue = venueOf.get(code) || '';
    const detail = clientOf.get(code) || {};
    const region = extractRegion(detail.address);
    const venueProf = venue ? segProf.get(`venue:${venue}`) : null;
    const btProf = detail.business_type ? segProf.get(`business_type:${detail.business_type}`) : null;
    const regionProf = region ? segProf.get(`region:${region}`) : null;
    const segScorers = { venue: toSegRank(venueProf), bt: toSegRank(btProf), region: toSegRank(regionProf) };
    const regionPriceRef = regionProf?.price_median || 0;
    if (venueProf || btProf || regionProf) segClients++;

    // typeShares (본인 + 업장·업태 세그먼트 블렌드; 지역 제외)
    const ownCnt: Record<string, number> = {}; let ownTot = 0;
    for (const [no, a] of Object.entries(purchaseAgg)) {
      const w = wineMap.get(String(no));
      const bl = bucketLabel(normalizeType(w?.wine_type || '', w?.item_name_kr || (a as any).name || ''));
      if (!bl || bl === '기타') continue;
      ownCnt[bl] = (ownCnt[bl] || 0) + (a as any).count; ownTot += (a as any).count;
    }
    const segDist: Record<string, number> = {};
    for (const p of [venueProf, btProf]) {
      if (!p?.type_dist) continue;
      for (const [t, s] of Object.entries(p.type_dist)) if (t !== '기타') segDist[t] = (segDist[t] || 0) + (s as number);
    }
    const segTot = Object.values(segDist).reduce((a, b) => a + b, 0) || 1;
    const conf = Math.min(1, ownTot / 10);
    const typeShares: Record<string, number> = {};
    for (const t of new Set([...Object.keys(ownCnt), ...Object.keys(segDist)])) {
      const own = ownTot > 0 ? (ownCnt[t] || 0) / ownTot : 0;
      typeShares[t] = conf * own + (1 - conf) * (segDist[t] / segTot);
    }

    const core = {
      inventory, wineMap, purchaseAgg, prefs,
      priceBandPct: o.priceBandPct, geoCeiling: o.geoCeiling, maxSales90d: 1,
      scoreParams: DEFAULT_SCORE_PARAMS, mode: 'new' as const,
      regionPriceRef, typeShares, segScorers,
    };
    // 개인화 신호 as-of-T 재구성(T 이전 견적·출고만)
    const quoteFeedback = await getClientQuoteFeatures(code, regionRows as any, cutoff).catch(() => null);
    if (quoteFeedback) qfClients++;
    let conversionMap: Map<string, { quoted: number; converted: number }> | undefined;
    try {
      const conv = await getClientConversion(code, 60, 'wine', cutoff);
      conversionMap = new Map(conv.wines.map((w: any) => [w.item_code, { quoted: w.quoted_count, converted: w.converted_count }]));
    } catch { conversionMap = undefined; }
    for (let vi = 0; vi < VARIANTS.length; vi++) {
      const v = VARIANTS[vi];
      const scored = scoreRecommendations({
        ...core,
        ...(v.useQF && quoteFeedback ? { quoteFeedback } : {}),
        ...(v.useConv && conversionMap ? { conversionMap } : {}),
      });
      scoreRankMetrics(scored.map((s) => s.item_no), positives, aggVar[vi]);
    }
    scoreRankMetrics(bestsellerRank, positives, aggBest);
    KS.forEach((k, ki) => { randPrecision[ki] += positives.size / universe.size; });

    evaluated++; sumUniverse += universe.size; sumPositives += positives.size;
  }

  // ---- 5) 출력 ----
  if (evaluated === 0) { console.log('평가 대상 0곳 — 컷오프/최소이력 완화 필요.'); return; }
  const pct = (x: number) => (100 * x / evaluated).toFixed(1);
  const row = (label: string, m: { hit: number; precision: number; recall: number }[]) =>
    `  ${label.padEnd(16)} ` + KS.map((k, ki) => `k=${k}: hit ${pct(m[ki].hit).padStart(4)}%  P ${pct(m[ki].precision).padStart(4)}%  R ${pct(m[ki].recall).padStart(4)}%`).join('  | ');

  console.log(`평가 거래처: ${evaluated}곳(세그먼트매칭 ${segClients} · 견적이력 ${qfClients}) · 평균 정답 ${(sumPositives / evaluated).toFixed(1)}개 · 유니버스 ${Math.round(sumUniverse / evaluated)}개`);
  console.log(`(hit=상위k에 정답 포함 거래처 비율 · P=precision@k · R=recall@k · 거래처 매크로평균)\n`);
  VARIANTS.forEach((v, vi) => console.log(row(v.name, aggVar[vi])));
  console.log(row('인기순(비개인화)', aggBest));
  console.log(`  ${'랜덤(기대)'.padEnd(16)} ` + KS.map((k, ki) => `k=${k}: hit    -   P ${pct(randPrecision[ki]).padStart(4)}%  R    -  `).join('  | '));

  // 코어 대비 신호 기여 델타(hit@10) — 견적이력 있는 거래처에서만 발화하니 전체평균 델타는 희석됨
  const base = aggVar[0][0].hit; // 코어
  console.log(`\n  ▶ 코어 hit@10 = ${pct(base)}% · 신호 기여(hit@10, %p):`);
  VARIANTS.forEach((v, vi) => { if (vi === 0) return; const d = (aggVar[vi][0].hit - base) / evaluated * 100; console.log(`     ${v.name.padEnd(16)} ${d >= 0 ? '+' : ''}${d.toFixed(1)}%p`); });
}

main().then(() => process.exit(0)).catch((e) => { console.error('BACKTEST FAIL:', e); process.exit(1); });
