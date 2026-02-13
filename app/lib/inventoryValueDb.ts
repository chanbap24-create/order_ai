// 재고금액 이력 관리 (Supabase)

import { supabase } from "@/app/lib/db";

function getKstDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** CDV 또는 DL 재고금액을 오늘 날짜로 partial upsert (race-safe) */
export async function recordInventoryValuePartial(side: 'cdv' | 'dl', value: number) {
  const today = getKstDate();

  // 1) 먼저 upsert로 오늘 레코드 확보 (없으면 생성)
  await supabase
    .from('inventory_value_history')
    .upsert({ recorded_date: today }, { onConflict: 'recorded_date', ignoreDuplicates: true });

  // 2) 해당 side만 업데이트
  const col = side === 'cdv' ? 'cdv_value' : 'dl_value';
  await supabase
    .from('inventory_value_history')
    .update({ [col]: value })
    .eq('recorded_date', today);
}

/** 최근 이력 조회 (차트용) */
export async function getInventoryValueHistory(limit: number = 90) {
  const { data } = await supabase
    .from('inventory_value_history')
    .select('recorded_date, cdv_value, dl_value')
    .order('recorded_date', { ascending: true })
    .limit(limit);

  return (data || []) as Array<{ recorded_date: string; cdv_value: number; dl_value: number }>;
}
