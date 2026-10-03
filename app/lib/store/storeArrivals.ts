// 매장별 입고 기록 — 매장 재고가 0 → 1 이상이 된 날을 store_stock_arrivals에 남긴다(DB 함수 fn_record_store_arrivals).
// 재고 업로드 직후 + 매일 크론(업로드 경로가 여러 개라 누락 대비)에서 호출. 업로드 도중 호출은 함수가 알아서 건너뜀.
import { supabase } from '../db';
import { logger } from '../logger';

export type StoreArrivalRun = { side: 'cdv' | 'dl'; arrived_today: number; skipped: boolean };

export async function recordStoreArrivals(): Promise<StoreArrivalRun[]> {
  const { data, error } = await supabase.rpc('fn_record_store_arrivals');
  if (error) throw error;
  const runs = (data || []) as StoreArrivalRun[];
  logger.info(`[StoreArrivals] ${runs.map((r) => `${r.side}: 오늘 입고 ${r.arrived_today}${r.skipped ? '(건너뜀)' : ''}`).join(', ')}`);
  return runs;
}
