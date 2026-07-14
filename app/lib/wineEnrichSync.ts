// 와인 정보 자동 보강 (재고 동기화 시) — 엑셀 와인리스트에 빈칸(지역·영문명 등)이 안 남게.
//   1) 형제 상속: 같은 품번 베이스(빈티지 자리 제거) 또는 같은 한글명의 기존/단종 와인에서
//      비어있는 필드(지역·영문명·품종·타입·공급자·이미지)를 승계 — 새 빈티지 재등록이 주 대상.
//   2) GPT 보강: 형제가 없는 완전 신규 와인의 지역·영문명을 gpt-4o-mini 로 채움(확신 없으면 비워둠).
// detectNewWines() 마지막에 호출된다.
import OpenAI from 'openai';
import { supabase } from './db';
import { logger } from './logger';

type WineLite = {
  item_code: string;
  item_name_kr: string | null;
  item_name_en: string | null;
  region: string | null;
  grape_varieties: string | null;
  wine_type: string | null;
  supplier: string | null;
  supplier_kr: string | null;
  image_url: string | null;
  brand: string | null;
  country_en: string | null;
  status: string | null;
};

const INHERIT_FIELDS = [
  'region', 'item_name_en', 'grape_varieties', 'wine_type', 'supplier', 'supplier_kr', 'image_url',
] as const;

/** 품번 베이스 키 — 3~4번째 자리(빈티지)만 제거. 같은 와인의 다른 빈티지가 같은 키. */
function baseKey(code: string): string {
  return code.length >= 5 ? code.slice(0, 2) + code.slice(4) : code;
}

const empty = (v: string | null | undefined) => !v || !String(v).trim();

async function loadAllWines(): Promise<WineLite[]> {
  const out: WineLite[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase.from('wines')
      .select('item_code, item_name_kr, item_name_en, region, grape_varieties, wine_type, supplier, supplier_kr, image_url, brand, country_en, status')
      .range(off, off + 999);
    if (error) { logger.error('[WineEnrich] wines load 실패', { error }); break; }
    out.push(...((data || []) as WineLite[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** 형제(다른 빈티지·재등록 품번)에게서 빈 필드 승계. 단종 와인도 도너로 사용. */
export async function backfillFromSiblings(): Promise<number> {
  const wines = await loadAllWines();
  if (wines.length === 0) return 0;

  const score = (w: WineLite) => INHERIT_FIELDS.filter((f) => !empty(w[f])).length;
  const pickBetter = (map: Map<string, WineLite>, key: string, w: WineLite) => {
    const cur = map.get(key);
    if (!cur || score(w) > score(cur)) map.set(key, w);
  };
  const byBase = new Map<string, WineLite>();
  const byName = new Map<string, WineLite>();
  for (const w of wines) {
    pickBetter(byBase, baseKey(w.item_code), w);
    if (w.item_name_kr) pickBetter(byName, w.item_name_kr.trim(), w);
  }

  let filled = 0;
  for (const w of wines) {
    if (w.status === 'discontinued') continue;
    const missing = INHERIT_FIELDS.filter((f) => empty(w[f]));
    if (missing.length === 0) continue;

    const donor = [byBase.get(baseKey(w.item_code)), w.item_name_kr ? byName.get(w.item_name_kr.trim()) : undefined]
      .find((d) => d && d.item_code !== w.item_code && missing.some((f) => !empty(d[f])));
    if (!donor) continue;

    const update: Record<string, string> = {};
    for (const f of missing) if (!empty(donor[f])) update[f] = donor[f] as string;
    if (Object.keys(update).length === 0) continue;

    const { error } = await supabase.from('wines')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('item_code', w.item_code);
    if (!error) filled++;
  }
  if (filled > 0) logger.info(`[WineEnrich] 형제 상속으로 ${filled}개 와인 보강`);
  return filled;
}

/**
 * 업로드된 테이스팅 노트(PPTX, GitHub 릴리스)에서 와인 메타 자동 보강.
 * AI 조사 없이도 노트만 올려두면 동기화 때 지역·품종·영문명 등 빈 칸이 채워진다.
 * 노트 본문(양조/색·향·맛/페어링)도 같은 파일에서 빈 칸만 채움.
 */
export async function backfillFromTastingNotes(limit = 40): Promise<number> {
  if (!process.env.GITHUB_TOKEN) return 0;

  const { data } = await supabase.from('wines')
    .select('item_code')
    .neq('status', 'discontinued')
    .or('region.is.null,region.eq.,item_name_en.is.null,item_name_en.eq.,grape_varieties.is.null,grape_varieties.eq.');
  const targets = (data || []).map((w) => w.item_code);
  if (targets.length === 0) return 0;

  const { listReleaseAssetNames } = await import('./githubRelease');
  const { parseWineFieldsFromPptx, parseTastingNotesFromPptx } = await import('./tastingNotePptxParse');
  const { backfillWineFieldsIfEmpty, backfillTastingNoteIfEmpty } = await import('./wineDb');

  let names: Set<string>;
  try { names = await listReleaseAssetNames(); }
  catch (e) { logger.warn(`[WineEnrich] 릴리스 목록 조회 실패: ${e instanceof Error ? e.message : e}`); return 0; }

  const RELEASE_BASE = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
  let filled = 0;
  let processed = 0;
  for (const code of targets) {
    if (processed >= limit) break;
    if (!names.has(`${code}.pptx`)) continue;
    processed++;
    try {
      const res = await fetch(`${RELEASE_BASE}/${code}.pptx`, { cache: 'no-store' });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const fields = await parseWineFieldsFromPptx(buffer);
      const done = await backfillWineFieldsIfEmpty(code, fields);
      const noteFields = await parseTastingNotesFromPptx(buffer);
      await backfillTastingNoteIfEmpty(code, noteFields);
      if (done.length) filled++;
    } catch (e) {
      logger.warn(`[WineEnrich] 노트 백필 실패 ${code}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (filled > 0) logger.info(`[WineEnrich] 테이스팅 노트에서 ${filled}개 와인 보강`);
  return filled;
}

const FILL_PROMPT = `You are a wine catalog specialist. For each Korean-imported wine below, provide:
- "region": the wine's specific region in English (e.g. "Saint Joseph, Northern Rhone", "Rioja", "Napa Valley"). Use the producer/name to determine it.
- "item_name_en": the proper English wine name (producer + cuvée, no vintage year).
Rules:
- Only fill a field if you are confident about THIS specific producer/wine. If unsure, use null.
- Do NOT invent regions for unfamiliar producers.
Respond ONLY with a JSON object: {"wines": [{"code": "...", "region": "..." | null, "item_name_en": "..." | null}, ...]}`;

/** 형제가 없는 신규 와인의 지역·영문명을 GPT 로 보강. 한 번에 limit 개까지(동기화마다 점진 소진). */
export async function fillMissingWithGPT(limit = 60): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return 0;

  const { data } = await supabase.from('wines')
    .select('item_code, item_name_kr, item_name_en, region, brand, supplier, country_en')
    .neq('status', 'discontinued')
    .or('region.is.null,region.eq.,item_name_en.is.null,item_name_en.eq.')
    .limit(limit);
  const targets = (data || []).filter((w) => w.item_name_kr || w.item_name_en);
  if (targets.length === 0) return 0;

  const client = new OpenAI({ apiKey });
  let filled = 0;

  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20);
    const input = batch.map((w) => ({
      code: w.item_code,
      name_kr: w.item_name_kr,
      name_en: w.item_name_en || null,
      producer: w.supplier || w.brand || null,
      country: w.country_en || null,
    }));
    try {
      const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: FILL_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
      });
      const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
      const rows: Array<{ code?: string; region?: string | null; item_name_en?: string | null }> =
        Array.isArray(parsed?.wines) ? parsed.wines : [];
      for (const r of rows) {
        const target = batch.find((w) => w.item_code === r.code);
        if (!target) continue;
        const update: Record<string, string> = {};
        if (empty(target.region) && r.region && r.region.trim()) update.region = r.region.trim();
        if (empty(target.item_name_en) && r.item_name_en && r.item_name_en.trim()) update.item_name_en = r.item_name_en.trim();
        if (Object.keys(update).length === 0) continue;
        const { error } = await supabase.from('wines')
          .update({ ...update, updated_at: new Date().toISOString() })
          .eq('item_code', target.item_code);
        if (!error) filled++;
      }
    } catch (e) {
      logger.warn(`[WineEnrich] GPT 보강 배치 실패(비치명): ${e instanceof Error ? e.message : e}`);
    }
  }
  if (filled > 0) logger.info(`[WineEnrich] GPT로 ${filled}개 와인 지역/영문명 보강`);
  return filled;
}

/** 동기화 훅 — ① 형제 상속(무료·정확) ② 업로드된 테이스팅 노트 ③ 남은 것 GPT. 실패해도 동기화는 성공 처리. */
export async function enrichWinesAfterSync(): Promise<{ inherited: number; noteFilled: number; gptFilled: number }> {
  try {
    const inherited = await backfillFromSiblings();
    const noteFilled = await backfillFromTastingNotes();
    const gptFilled = await fillMissingWithGPT();
    return { inherited, noteFilled, gptFilled };
  } catch (e) {
    logger.warn(`[WineEnrich] 보강 실패(비치명): ${e instanceof Error ? e.message : e}`);
    return { inherited: 0, noteFilled: 0, gptFilled: 0 };
  }
}
