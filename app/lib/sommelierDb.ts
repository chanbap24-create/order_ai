// 소믈리에 고객·문답 세션·구매 기록 DB 접근 (서버 전용).
// 고객은 핸드폰(숫자 정규화) 기준 upsert — 재방문 시 같은 고객으로 이력 누적.
import { supabase } from './db';
import type { QuizAnswers } from '@/app/sommelier/lib/quiz';
import type { SommelierResult } from './sommelierRecommend';

export type SommelierCustomer = { id: number; name: string; phone: string };

/** 핸드폰 기준 고객 upsert. 이름이 바뀌면 최신으로 갱신. */
export async function upsertCustomer(name: string, phone: string): Promise<SommelierCustomer> {
  const { data: existing } = await supabase
    .from('sommelier_customers').select('id, name, phone').eq('phone', phone).maybeSingle();
  if (existing) {
    if (existing.name !== name) {
      await supabase.from('sommelier_customers')
        .update({ name, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
    return { ...existing, name };
  }
  const { data, error } = await supabase
    .from('sommelier_customers').insert({ name, phone }).select('id, name, phone').single();
  if (error || !data) throw new Error(`고객 등록 실패: ${error?.message}`);
  return data;
}

/** 문답 세션 저장(답변 + 추천 결과 스냅샷) → session_id */
/** 재방문 고객 검색 — 숫자 입력이면 전화번호 부분일치, 아니면 이름 부분일치. 최대 3명 */
export async function searchCustomers(q: string): Promise<SommelierCustomer[]> {
  const digits = q.replace(/[^0-9]/g, '');
  const base = supabase.from('sommelier_customers').select('id, name, phone').limit(3);
  const { data } = digits.length >= 3
    ? await base.like('phone', `%${digits}%`).order('id', { ascending: false })
    : await base.ilike('name', `%${q.replace(/[%_]/g, '')}%`).order('id', { ascending: false });
  return (data || []) as SommelierCustomer[];
}

export async function saveSession(
  customerId: number, manager: string, answers: QuizAnswers, results: SommelierResult[],
): Promise<number> {
  const { data, error } = await supabase
    .from('sommelier_sessions')
    .insert({
      customer_id: customerId, manager, answers,
      results: results.map((r) => ({
        item_code: r.item_code, name: r.name, retail_price: r.retail_price, score: r.score,
      })),
    })
    .select('id').single();
  if (error || !data) throw new Error(`세션 저장 실패: ${error?.message}`);
  return data.id;
}

/** 구매 기록 취소 — 같은 고객·품번(+세션)의 기록 삭제 */
export async function deleteOrder(customerId: number, itemCode: string, sessionId: number | null): Promise<void> {
  let q = supabase.from('sommelier_orders').delete()
    .eq('customer_id', customerId).eq('item_code', itemCode);
  q = sessionId ? q.eq('session_id', sessionId) : q;
  const { error } = await q;
  if (error) throw new Error(`구매 기록 취소 실패: ${error.message}`);
}

/** 손님이 구매한 와인 기록 */
export async function saveOrder(o: {
  customerId: number; sessionId: number | null; itemCode: string; itemName: string;
  retailPrice: number; quantity: number; manager: string;
}): Promise<void> {
  const { error } = await supabase.from('sommelier_orders').insert({
    customer_id: o.customerId, session_id: o.sessionId,
    item_code: o.itemCode, item_name: o.itemName,
    retail_price: o.retailPrice, quantity: o.quantity, manager: o.manager,
  });
  if (error) throw new Error(`구매 기록 실패: ${error.message}`);
}
