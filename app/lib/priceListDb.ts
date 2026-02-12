// 가격리스트 DB 헬퍼 (Supabase)

import { supabase } from "@/app/lib/db";
import type { PriceHistoryEntry } from "@/app/types/wine";

/** 최근 가격 변동 내역 조회 */
export async function getRecentPriceChanges(days: number = 30): Promise<PriceHistoryEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('price_history')
    .select('*')
    .gte('detected_at', since)
    .order('detected_at', { ascending: false });
  return (data || []) as PriceHistoryEntry[];
}

/** 특정 와인의 가격 이력 조회 */
export async function getPriceHistory(itemCode: string): Promise<PriceHistoryEntry[]> {
  const { data } = await supabase
    .from('price_history')
    .select('*')
    .eq('item_code', itemCode)
    .order('detected_at', { ascending: false });
  return (data || []) as PriceHistoryEntry[];
}

export { detectPriceChanges } from "@/app/lib/wineDetection";
