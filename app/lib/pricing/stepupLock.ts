// 하위거래처 보정(매출등급 1단계업) 분기 1회 락.
// 소모 시점 = 보정 적용 견적의 실제 담기/발행(quote 기록) — 생성(미리보기)만으론 소모 안 됨.
import { supabase } from '../db';
import { logger } from '../logger';

/** KST 기준 현재 분기 키: 'YYYY-Qn' */
export function currentQuarterKey(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-Q${Math.floor(kst.getUTCMonth() / 3) + 1}`;
}

/** 이 거래처가 이번 분기에 보정 견적을 이미 발행했는가 */
export async function isStepUpUsed(clientCode: string): Promise<boolean> {
  const { data } = await supabase
    .from('discount_stepup_usage')
    .select('client_code')
    .eq('client_code', clientCode)
    .eq('quarter', currentQuarterKey())
    .maybeSingle();
  return !!data;
}

/** 보정 사용 해제 — 보정 견적을 삭제(폐기)했을 때 분기 락을 되살린다. */
export async function releaseStepUp(clientCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('discount_stepup_usage')
    .delete()
    .eq('client_code', clientCode)
    .eq('quarter', currentQuarterKey())
    .select('client_code');
  if (error) {
    logger.warn(`[StepUpLock] 해제 실패 ${clientCode}: ${error.message}`);
    return false;
  }
  return (data || []).length > 0;
}

/** 보정 사용 기록 (이미 있으면 무시) */
export async function markStepUpUsed(clientCode: string, manager?: string | null): Promise<void> {
  const { error } = await supabase
    .from('discount_stepup_usage')
    .upsert(
      { client_code: clientCode, quarter: currentQuarterKey(), manager: manager || null },
      { onConflict: 'client_code,quarter', ignoreDuplicates: true },
    );
  if (error) logger.warn(`[StepUpLock] 기록 실패 ${clientCode}: ${error.message}`);
}
