import { supabase } from '@/app/lib/db';
import type { ShipmentRow, ClientDetail } from './types';

/**
 * 매니저의 최근 12개월 shipments 전량 페이지네이션 로드.
 */
export async function fetchShipmentsForManager(manager: string, fromDate: string): Promise<ShipmentRow[]> {
  const all: ShipmentRow[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('shipments')
      .select('client_code, client_name, item_no, item_name, quantity, total_amount, ship_date')
      .eq('manager', manager)
      .gte('ship_date', fromDate)
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as ShipmentRow[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

/**
 * 매니저의 전체 거래처 상세 (visit_schedule/churn에 재사용).
 */
export async function fetchAllClientDetails(manager: string): Promise<ClientDetail[]> {
  // 페이지네이션 — PostgREST 1000행 캡 회피(담당 거래처 1000곳 초과 매니저 누락 방지)
  const out: ClientDetail[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase
      .from('client_details')
      .select('client_code, client_name, importance, visit_cycle_days, last_visit_date')
      .eq('manager', manager)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const d of data) {
      out.push({
        client_code: d.client_code,
        client_name: d.client_name || d.client_code,
        importance: d.importance,
        visit_cycle_days: d.visit_cycle_days || 30,
        last_visit_date: d.last_visit_date || null,
      });
    }
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * shipments에는 있지만 client_details에 없는 거래처의 상세 추가 로드.
 */
export async function fetchMissingClientDetails(missingCodes: string[]) {
  const out: Array<{ client_code: string; importance: number | null; visit_cycle_days: number; last_visit_date: string | null; manager: string | null }> = [];
  for (let i = 0; i < missingCodes.length; i += 500) {
    const batch = missingCodes.slice(i, i + 500);
    const { data } = await supabase
      .from('client_details')
      .select('client_code, importance, visit_cycle_days, last_visit_date, manager')
      .in('client_code', batch);
    for (const d of data || []) {
      out.push({
        client_code: d.client_code,
        importance: d.importance,
        visit_cycle_days: d.visit_cycle_days || 30,
        last_visit_date: d.last_visit_date || null,
        manager: d.manager || null,
      });
    }
  }
  return out;
}

/**
 * 향후 7일 planned 미팅 (JOIN client_details).
 */
export function createMeetingsPromise(today: string, sevenDaysLater: string) {
  return supabase
    .from('meetings')
    .select('id, client_code, meeting_date, meeting_time, meeting_type, purpose, ai_briefing, status, manager, client_details(client_name, importance, manager)')
    .eq('status', 'planned')
    .gte('meeting_date', today)
    .lte('meeting_date', sevenDaysLater)
    .order('meeting_date', { ascending: true });
}

/**
 * wines 전체 페이지네이션 로드 (upsell/new_arrival/season 공용).
 */
export async function fetchAllWines() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let wFrom = 0;
  while (true) {
    const { data } = await supabase
      .from('wines')
      .select('item_code, item_name_kr, country, grape_varieties, wine_type')
      .range(wFrom, wFrom + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    wFrom += 1000;
  }
  return all;
}

/**
 * inventory_cdv 재고 있는 품목 전량 로드.
 */
export async function fetchInStockInventory() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let invFrom = 0;
  while (true) {
    const { data } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, supply_price, available_stock')
      .gt('available_stock', 0)
      .range(invFrom, invFrom + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    invFrom += 1000;
  }
  return all;
}

/**
 * 재고 배치 조회 (CDV 우선, DL fallback).
 */
export async function fetchStockMap(itemNos: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  for (let i = 0; i < itemNos.length; i += 500) {
    const batch = itemNos.slice(i, i + 500);
    const [cdvRes, dlRes] = await Promise.all([
      supabase.from('inventory_cdv').select('item_no, available_stock').in('item_no', batch),
      supabase.from('inventory_dl').select('item_no, available_stock').in('item_no', batch),
    ]);
    for (const d of cdvRes.data || []) {
      stockMap.set(d.item_no, d.available_stock ?? 0);
    }
    for (const d of dlRes.data || []) {
      if (!stockMap.has(d.item_no)) stockMap.set(d.item_no, d.available_stock ?? 0);
    }
  }
  return stockMap;
}
