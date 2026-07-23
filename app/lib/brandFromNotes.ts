// 업로드된 테이스팅 노트의 와이너리 소개로 브랜드자료실(brands)을 자동 보강.
// 노트 backfill 시 호출 — 브랜드가 미등록이거나 description이 비었을 때만 채움(기존 값 덮어쓰기 없음).
import { supabase } from './db';
import { logger } from './logger';

/** 같은 브랜드 와인들의 이름 공통 접두어로 브랜드명 추정. 쉼표 앞까지·2글자 이상만 인정. */
function commonPrefix(names: string[]): string {
  const list = names.map((n) => (n || '').trim()).filter(Boolean);
  if (!list.length) return '';
  let p = list[0];
  for (const n of list.slice(1)) {
    let i = 0;
    while (i < p.length && i < n.length && p[i] === n[i]) i++;
    p = p.slice(0, i);
  }
  p = p.split(',')[0].trim();
  return p.length >= 2 ? p : '';
}

/** 노트에 와이너리 소개가 있는 모든 브랜드를 일괄 동기화(미등록·소개 빈 브랜드만).
 *  반환: 반영된 브랜드코드 목록. */
export async function syncAllBrandsFromNotes(): Promise<string[]> {
  // 와이너리 소개가 있는 노트의 와인 → 브랜드코드별 대표 와인 1개
  const noteWines: { wine_id: string }[] = [];
  for (let from = 0; ; from += 1000) { // 1000행 캡 페이지네이션
    const { data } = await supabase
      .from('tasting_notes').select('wine_id').not('winery_description', 'is', null)
      .neq('winery_description', '').range(from, from + 999);
    noteWines.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const codes = noteWines.map((n) => n.wine_id);
  const seedByBrand = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 500) {
    const { data: wines } = await supabase
      .from('wines').select('item_code, brand').in('item_code', codes.slice(i, i + 500));
    for (const w of wines || []) {
      const bc = (w.brand || '').toUpperCase();
      if (bc && bc !== 'CDV' && !seedByBrand.has(bc)) seedByBrand.set(bc, w.item_code);
    }
  }
  const synced: string[] = [];
  for (const seed of seedByBrand.values()) {
    const bc = await syncBrandFromNotes(seed);
    if (bc) synced.push(bc);
  }
  return synced;
}

/** wineId의 브랜드가 자료실에 없거나 소개가 비면, 그 브랜드 와인 노트의 와이너리 소개
 *  (가장 긴 것)로 등록/보강. 반환: 반영된 브랜드코드 또는 null. */
export async function syncBrandFromNotes(wineId: string): Promise<string | null> {
  const { data: wine } = await supabase.from('wines').select('brand').eq('item_code', wineId).maybeSingle();
  const bc = (wine?.brand || '').toUpperCase();
  if (!bc || bc === 'CDV') return null; // CDV=자사 판촉물 코드

  const { data: existing } = await supabase
    .from('brands').select('id, description').eq('brand_code', bc).maybeSingle();
  if (existing && (existing.description || '').trim()) return null; // 이미 소개 있음 → 건드리지 않음

  // 같은 브랜드 와인들 + 노트의 와이너리 소개(가장 긴 것)
  const { data: wines } = await supabase
    .from('wines').select('item_code, item_name_kr, item_name_en, country').ilike('brand', bc);
  const codes = (wines || []).map((w) => w.item_code);
  if (!codes.length) return null;
  const { data: notes } = await supabase
    .from('tasting_notes').select('wine_id, winery_description').in('wine_id', codes);
  const desc = (notes || [])
    .map((n) => (n.winery_description || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  if (!desc) return null;

  if (existing) {
    await supabase.from('brands').update({ description: desc, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    const nameKr = commonPrefix((wines || []).map((w) => w.item_name_kr)) || bc;
    const nameEn = commonPrefix((wines || []).map((w) => w.item_name_en)) || null;
    const country = (wines || []).map((w) => w.country).find(Boolean) || null;
    const { error } = await supabase.from('brands').insert({
      brand_code: bc, brand_name_kr: nameKr, brand_name_en: nameEn, country, description: desc,
    });
    if (error) {
      logger.warn(`[brandFromNotes] ${bc} 등록 실패: ${error.message}`);
      return null;
    }
  }
  logger.info(`[brandFromNotes] ${bc} 브랜드자료실 보강(노트 와이너리 소개, ${desc.length}자)`);
  return bc;
}
