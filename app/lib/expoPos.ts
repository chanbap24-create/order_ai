// 행사 POS(/expo-pos) 서버 백업 — 기기별 상태 스냅샷 업서트/조회.
// 페이지는 로그인 없이 열리므로 행사 코드(EXPO_POS_KEY)로만 보호한다. 판매 기록 외 데이터 접근 없음.
import { supabase } from './db';
import { getEnv } from './env';

export type ExpoSnapshotMeta = {
  device_id: string;
  device_name: string;
  event_name: string;
  sales_count: number;
  updated_at: string;
};

const MAX_STATE_BYTES = 2_000_000;

/** 행사 코드 검증. 미설정이면 항상 false (fail-closed) */
export function checkExpoKey(key: string | null): boolean {
  const expected = getEnv('EXPO_POS_KEY');
  return !!expected && !!key && key === expected;
}

export async function upsertSnapshot(p: {
  deviceId: string; deviceName: string; eventName: string; state: unknown;
}): Promise<ExpoSnapshotMeta> {
  const json = JSON.stringify(p.state);
  if (json.length > MAX_STATE_BYTES) throw new Error('상태 데이터가 너무 큽니다');
  const sales = (p.state as { sales?: unknown[] })?.sales;
  const { data, error } = await supabase.from('expo_pos_snapshots').upsert({
    device_id: p.deviceId,
    device_name: p.deviceName.slice(0, 60),
    event_name: p.eventName.slice(0, 60),
    state: p.state,
    sales_count: Array.isArray(sales) ? sales.length : 0,
    updated_at: new Date().toISOString(),
  }).select('device_id, device_name, event_name, sales_count, updated_at').single();
  if (error) throw error;
  return data as ExpoSnapshotMeta;
}

/** 복원 화면용 기기 목록 (상태 본문 제외, 최근 갱신순) */
export async function listSnapshots(): Promise<ExpoSnapshotMeta[]> {
  const { data, error } = await supabase.from('expo_pos_snapshots')
    .select('device_id, device_name, event_name, sales_count, updated_at')
    .order('updated_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []) as ExpoSnapshotMeta[];
}

export async function getSnapshot(deviceId: string): Promise<{ meta: ExpoSnapshotMeta; state: unknown } | null> {
  const { data, error } = await supabase.from('expo_pos_snapshots').select('*').eq('device_id', deviceId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { state, ...meta } = data as ExpoSnapshotMeta & { state: unknown };
  return { meta, state };
}
