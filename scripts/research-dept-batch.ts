// 백화점(dept_batch) 와인 배치 조사 러너 — 노트 없는 와인을 Claude로 조사해 저장.
// 배치 라우트(processOneWine)와 동일 로직: 신뢰도<50 저장 거부, 구조 프로파일·향미 태그 포함.
// 실행: npx tsx --env-file=.env.local scripts/research-dept-batch.ts [--limit 12] [--dry]
import { supabase } from '../app/lib/db';
import { researchWineWithClaude } from '../app/lib/claudeWineResearch';
import { upsertWine, upsertTastingNote } from '../app/lib/wineDb';
import { ensureRegionsClassified } from '../app/api/admin/wine-regions/lib/classify';

const DRY = process.argv.includes('--dry');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) || 0 : 0;
const CONCURRENCY = 2;
const STORE_COLS = ['store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai'];

type Target = { item_code: string; item_name_kr: string; item_name_en: string; vintage: string | null; store: number };

async function pickTargets(): Promise<Target[]> {
  const { data: wines } = await supabase
    .from('wines')
    .select('item_code, item_name_kr, item_name_en, vintage, tasting_notes(id)')
    .eq('dept_batch', true)
    .not('item_name_en', 'is', null);
  const noNote = (wines || []).filter((w) => {
    const tn = Array.isArray(w.tasting_notes) ? w.tasting_notes[0] : w.tasting_notes;
    return !tn;
  });
  // 매장 재고 합으로 정렬(많이 팔리는 것 우선)
  const codes = noNote.map((w) => w.item_code);
  const storeSum = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 500) {
    const { data: inv } = await supabase.from('inventory_cdv')
      .select(`item_no, ${STORE_COLS.join(', ')}`).in('item_no', codes.slice(i, i + 500));
    for (const r of (inv || []) as Record<string, unknown>[]) {
      storeSum.set(String(r.item_no), STORE_COLS.reduce((s, c) => s + (Number(r[c]) || 0), 0));
    }
  }
  const sorted = noNote
    .map((w) => ({
      item_code: w.item_code, item_name_kr: w.item_name_kr, item_name_en: w.item_name_en!,
      vintage: w.vintage, store: storeSum.get(w.item_code) || 0,
    }))
    .sort((a, b) => b.store - a.store);
  if (!LIMIT) return sorted;
  // 파일럿: 타사/자사 반반 섞어서
  const zk = sorted.filter((w) => w.item_code.startsWith('ZK')).slice(0, Math.ceil(LIMIT / 2));
  const own = sorted.filter((w) => !w.item_code.startsWith('ZK')).slice(0, Math.floor(LIMIT / 2));
  return [...zk, ...own].slice(0, LIMIT);
}

async function processOne(t: Target): Promise<string> {
  try {
    const { result, validation } = await researchWineWithClaude(t.item_code, t.item_name_kr, t.item_name_en, t.vintage || undefined);
    if (validation.confidence < 50) {
      return `❌ ${t.item_code} ${t.item_name_kr} — 신뢰도 ${validation.confidence} (다른 와인 조사됨, 저장 안 함) ${validation.issues.join('; ')}`;
    }
    await upsertWine({
      item_code: t.item_code,
      item_name_en: result.item_name_en,
      country_en: result.country_en,
      region: result.region,
      grape_varieties: result.grape_varieties,
      wine_type: result.wine_type,
      alcohol: result.alcohol_percentage || null,
      ai_researched: 1,
      ...(result.image_url ? { image_url: result.image_url } : {}),
    });
    await upsertTastingNote(t.item_code, {
      winemaking: result.winemaking,
      winery_description: result.winery_description,
      vintage_note: result.vintage_note,
      aging_potential: result.aging_potential,
      color_note: result.color_note,
      nose_note: result.nose_note,
      palate_note: result.palate_note,
      food_pairing: result.food_pairing,
      glass_pairing: result.glass_pairing,
      serving_temp: result.serving_temp,
      awards: result.awards,
      flavor_tags: result.flavor_tags && result.flavor_tags.length ? result.flavor_tags : null,
      flavor_research_at: result.flavor_tags && result.flavor_tags.length ? new Date().toISOString() : null,
      body: result.body ?? null,
      sweetness: result.sweetness ?? null,
      acidity: result.acidity ?? null,
      tannin: result.tannin ?? null,
      ai_generated: 1,
    } as Record<string, unknown>);
    return `✅ ${t.item_code} ${t.item_name_kr} | conf ${validation.confidence} | B${result.body ?? '-'} S${result.sweetness ?? '-'} A${result.acidity ?? '-'} T${result.tannin ?? '-'} | 향미 ${result.flavor_tags?.length ?? 0} | 병샷 ${result.image_url ? 'O' : 'X'}`;
  } catch (e) {
    return `⚠️ ${t.item_code} ${t.item_name_kr} — 오류: ${e instanceof Error ? e.message : e}`;
  }
}

async function main() {
  const targets = await pickTargets();
  console.log(`조사 대상: ${targets.length}종${DRY ? ' (dry)' : ''}`);
  if (DRY) { for (const t of targets) console.log(' ', t.item_code, t.item_name_kr, '|', t.item_name_en, '| 매장', t.store); return; }

  const okCodes: string[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const outs = await Promise.all(batch.map(processOne));
    for (let j = 0; j < outs.length; j++) {
      console.log(`[${i + j + 1}/${targets.length}]`, outs[j]);
      if (outs[j].startsWith('✅')) okCodes.push(batch[j].item_code);
    }
  }
  // 조사된 산지 → 와인산지DB 자동 분류(1회)
  try {
    if (okCodes.length) {
      const { data: ok } = await supabase.from('wines')
        .select('region, item_name_kr, item_name_en, country_en, country').in('item_code', okCodes);
      await ensureRegionsClassified((ok || []).map((w) => ({
        region: w.region, name: `${w.item_name_kr || ''} ${w.item_name_en || ''}`, country: w.country_en || w.country || '',
      })));
    }
  } catch (e) { console.error('산지 분류 실패:', e instanceof Error ? e.message : e); }
  console.log(`완료: 성공 ${okCodes.length} / 실패 ${targets.length - okCodes.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
