// 와인 관리 시스템 DB 테이블 및 CRUD (Supabase)

import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { getCountryPair } from "@/app/lib/countryMapping";
import { extractGrapesFromName, extractTypeFromName } from "@/app/lib/wineNameExtract";
import type { Wine, TastingNote, AdminSetting } from "@/app/types/wine";

/* ─── 테이블 생성 (no-op) ─── */
export function ensureWineTables() {
  // no-op: 테이블은 Supabase migration에서 생성됨
}

/* ─── Wines CRUD ─── */

export async function getWines(filters?: { status?: string; search?: string; country?: string }): Promise<Wine[]> {
  let query = supabase.from('wines').select('*');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`item_name_kr.ilike.${term},item_name_en.ilike.${term},item_code.ilike.${term}`);
  }
  if (filters?.country) {
    query = query.or(`country.eq.${filters.country},country_en.eq.${filters.country}`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) { logger.warn('getWines error', { error }); return []; }
  return (data || []) as Wine[];
}

export async function getWineByCode(itemCode: string): Promise<Wine | undefined> {
  const { data } = await supabase
    .from('wines')
    .select('*')
    .eq('item_code', itemCode)
    .maybeSingle();
  return data as Wine | undefined;
}

export async function upsertWine(wine: Partial<Wine> & { item_code: string }) {
  const existing = await getWineByCode(wine.item_code);

  // country ↔ country_en 자동 동기화 (한쪽이 변경되면 반대쪽도 항상 갱신)
  const syncedWine = { ...wine };
  if ('country_en' in syncedWine && syncedWine.country_en && !('country' in syncedWine)) {
    const { kr } = getCountryPair(syncedWine.country_en);
    if (kr) syncedWine.country = kr;
  }
  if ('country' in syncedWine && syncedWine.country && !('country_en' in syncedWine)) {
    const { en } = getCountryPair(syncedWine.country);
    if (en) syncedWine.country_en = en;
  }

  if (existing) {
    const updates: Record<string, unknown> = { ...syncedWine, updated_at: new Date().toISOString() };
    delete updates.item_code;
    delete updates.created_at;
    await supabase.from('wines').update(updates).eq('item_code', wine.item_code);
  } else {
    await supabase.from('wines').insert(syncedWine);
  }
}

export async function deleteWine(itemCode: string) {
  await supabase.from('tasting_notes').delete().eq('wine_id', itemCode);
  await supabase.from('wine_images').delete().eq('wine_id', itemCode);
  await supabase.from('wines').delete().eq('item_code', itemCode);
}

/* ─── Tasting Notes CRUD ─── */

export async function getTastingNote(wineId: string): Promise<TastingNote | undefined> {
  const { data } = await supabase
    .from('tasting_notes')
    .select('*')
    .eq('wine_id', wineId)
    .maybeSingle();
  return data as TastingNote | undefined;
}

export async function getTastingNotes(filters?: { search?: string; country?: string; hasNote?: boolean }): Promise<(Wine & { tasting_note_id: number | null })[]> {
  // Use wines with embedded tasting_notes
  let query = supabase.from('wines').select('*, tasting_notes(id)');

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`item_name_kr.ilike.${term},item_name_en.ilike.${term}`);
  }
  if (filters?.country) {
    query = query.or(`country.eq.${filters.country},country_en.eq.${filters.country}`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) { logger.warn('getTastingNotes error', { error }); return []; }

  return (data || []).map((w: any) => {
    const tn = Array.isArray(w.tasting_notes) ? w.tasting_notes[0] : w.tasting_notes;
    return {
      ...w,
      tasting_note_id: tn?.id ?? null,
      tasting_notes: undefined,
    };
  }).filter((w: any) => {
    if (filters?.hasNote === true) return w.tasting_note_id !== null;
    if (filters?.hasNote === false) return w.tasting_note_id === null;
    return true;
  }) as (Wine & { tasting_note_id: number | null })[];
}

export async function upsertTastingNote(wineId: string, note: Partial<TastingNote>) {
  // wines 테이블에서 추천용 속성 스냅샷 가져오기
  const { data: wine } = await supabase
    .from('wines')
    .select('supply_price, wine_type, country, region, grape_varieties, item_name_kr')
    .eq('item_code', wineId)
    .single();

  const snapshot = {
    supply_price: wine?.supply_price ?? note.supply_price ?? null,
    wine_type: note.wine_type || wine?.wine_type || null,
    country: note.country || wine?.country || null,
    region: note.region || wine?.region || null,
    grape_varieties: note.grape_varieties || wine?.grape_varieties || null,
  };

  // AI 리서치 → wines 역반영
  // 우선순위: 수동입력 > AI 리서치 > 이름 추출 backfill
  // 현재 값이 이름 추출 결과와 같으면 = backfill 데이터 → AI 덮어쓰기 허용
  // 현재 값이 이름 추출 결과와 다르면 = 수동 입력 → 보존
  const wineName = wine?.item_name_kr || '';
  const autoGrape = extractGrapesFromName(wineName);
  const autoType = extractTypeFromName(wineName);

  const wineUpdates: Record<string, unknown> = {};

  if (note.grape_varieties) {
    const cur = wine?.grape_varieties || '';
    // 비어있거나, 이름 자동추출 값이면 → AI로 덮어쓰기
    if (!cur || cur === autoGrape) {
      wineUpdates.grape_varieties = note.grape_varieties;
    }
    // 그 외(수동 입력)은 보존
  }
  if (note.wine_type) {
    const cur = wine?.wine_type || '';
    if (!cur || cur === autoType) {
      wineUpdates.wine_type = note.wine_type;
    }
  }
  if (note.country) {
    if (!wine?.country) {
      wineUpdates.country = note.country;
    }
  }
  if (note.region) {
    if (!wine?.region) {
      wineUpdates.region = note.region;
    }
  }

  if (Object.keys(wineUpdates).length > 0) {
    wineUpdates.updated_at = new Date().toISOString();
    await supabase.from('wines').update(wineUpdates).eq('item_code', wineId);
  }

  const existing = await getTastingNote(wineId);

  if (existing) {
    const updates: Record<string, unknown> = { ...note, ...snapshot, updated_at: new Date().toISOString() };
    delete updates.id;
    delete updates.wine_id;
    delete updates.created_at;
    await supabase.from('tasting_notes').update(updates).eq('wine_id', wineId);
  } else {
    await supabase.from('tasting_notes').insert({
      wine_id: wineId,
      color_note: note.color_note || null,
      nose_note: note.nose_note || null,
      palate_note: note.palate_note || null,
      food_pairing: note.food_pairing || null,
      glass_pairing: note.glass_pairing || null,
      serving_temp: note.serving_temp || null,
      awards: note.awards || null,
      winemaking: note.winemaking || null,
      winery_description: note.winery_description || null,
      vintage_note: note.vintage_note || null,
      aging_potential: note.aging_potential || null,
      ...snapshot,
      ai_generated: note.ai_generated || 0,
      manually_edited: note.manually_edited || 0,
      approved: note.approved || 0,
    });
  }
}

/* ─── Admin Settings ─── */

export async function getSetting(key: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value;
}

export async function setSetting(key: string, value: string) {
  await supabase
    .from('admin_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

/* ─── Statistics ─── */

export async function getWineStats() {
  const thresholdStr = await getSetting('low_stock_threshold') || '6';
  const threshold = parseInt(thresholdStr, 10);

  const { count: totalWines } = await supabase.from('wines').select('*', { count: 'exact', head: true });
  const { count: newWines } = await supabase.from('wines').select('*', { count: 'exact', head: true }).eq('status', 'new');

  // low stock: available_stock > 0 AND available_stock <= threshold
  const { data: lowStockData } = await supabase.from('wines')
    .select('item_code')
    .gt('available_stock', 0)
    .lte('available_stock', threshold);

  // price changes in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: priceChanges } = await supabase.from('price_history')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', thirtyDaysAgo);

  const { count: tnTotal } = await supabase.from('wines').select('*', { count: 'exact', head: true }).neq('status', 'discontinued');
  const { count: tnComplete } = await supabase.from('tasting_notes').select('*', { count: 'exact', head: true }).not('color_note', 'is', null);

  return {
    totalWines: totalWines || 0,
    newWines: newWines || 0,
    lowStock: lowStockData?.length || 0,
    priceChanges: priceChanges || 0,
    tastingNotesComplete: tnComplete || 0,
    tastingNotesTotal: tnTotal || 0,
  };
}

/* ─── New Wines with Status ─── */

export interface WineWithStatus extends Wine {
  tasting_note_id: number | null;
  ai_generated: number;
  approved: number;
  wine_status: 'detected' | 'researched' | 'approved';
}

export async function getNewWinesWithStatus(filters?: { status?: string; search?: string; wineStatus?: string }): Promise<WineWithStatus[]> {
  let query = supabase.from('wines').select('*, tasting_notes(id, ai_generated, approved)');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`item_name_kr.ilike.${term},item_name_en.ilike.${term},item_code.ilike.${term}`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) { logger.warn('getNewWinesWithStatus error', { error }); return []; }

  return (data || []).map((w: any) => {
    const tn = Array.isArray(w.tasting_notes) ? w.tasting_notes[0] : w.tasting_notes;
    const ai_gen = tn?.ai_generated ?? 0;
    const appr = tn?.approved ?? 0;
    let wine_status: 'detected' | 'researched' | 'approved' = 'detected';
    if (appr === 1) wine_status = 'approved';
    else if (ai_gen === 1 || w.ai_researched === 1) wine_status = 'researched';

    return {
      ...w,
      tasting_note_id: tn?.id ?? null,
      ai_generated: ai_gen,
      approved: appr,
      wine_status,
      tasting_notes: undefined,
    };
  }).filter((w: WineWithStatus) => {
    if (filters?.wineStatus === 'detected') return w.wine_status === 'detected';
    if (filters?.wineStatus === 'researched') return w.wine_status === 'researched';
    if (filters?.wineStatus === 'approved') return w.wine_status === 'approved';
    return true;
  }) as WineWithStatus[];
}

/* ─── Price List ─── */

export async function getWinesForPriceList(): Promise<Wine[]> {
  const { data } = await supabase
    .from('wines')
    .select('*')
    .neq('status', 'discontinued')
    .order('country_en', { ascending: true })
    .order('supplier', { ascending: true })
    .order('supply_price', { ascending: false });
  return (data || []) as Wine[];
}
