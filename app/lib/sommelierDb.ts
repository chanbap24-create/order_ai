// 소믈리에 고객·문답 세션·구매 기록 DB 접근 (서버 전용).
// 고객은 핸드폰(숫자 정규화) 기준 upsert — 재방문 시 같은 고객으로 이력 누적.
import { supabase } from './db';
import { todayKst } from './dateKst';
import type { QuizAnswers } from '@/app/sommelier/lib/quiz';
import type { SommelierResult } from './sommelierRecommend';

export type SommelierCustomer = { id: number; name: string; phone: string };

/** 핸드폰 기준 고객 upsert. 이름이 바뀌면 최신으로 갱신.
 *  marketingOptIn=true면 수신동의·시각 기록(선택 동의 — 철회는 false로 덮어쓰지 않고 별도 처리). */
export async function upsertCustomer(
  name: string, phone: string, createdBy?: string, marketingOptIn?: boolean,
): Promise<SommelierCustomer> {
  const { data: existing } = await supabase
    .from('sommelier_customers').select('id, name, phone').eq('phone', phone).maybeSingle();
  if (existing) {
    const upd: Record<string, unknown> = {};
    if (existing.name !== name) upd.name = name;
    if (marketingOptIn) { upd.marketing_opt_in = true; upd.marketing_opt_in_at = new Date().toISOString(); }
    if (Object.keys(upd).length) {
      await supabase.from('sommelier_customers')
        .update({ ...upd, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
    return { ...existing, name };
  }
  const { data, error } = await supabase
    .from('sommelier_customers').insert({
      name, phone, created_by: createdBy || null,
      marketing_opt_in: !!marketingOptIn,
      marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
    }).select('id, name, phone').single();
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

/** 손님이 구매한 와인 기록 — 같은 손님·품번·같은 날(KST)은 1건으로 유지(중복 방지).
 *  mode 'mark': 추천 카드 더블탭 = "이 와인 샀음" 표시. 이미 있으면 그대로 둔다(멱등).
 *  mode 'set' : 정산(POS) 기록 = 최종 수량·실결제 단가로 덮어쓴다(재기록해도 1건). */
export async function saveOrder(o: {
  customerId: number; sessionId: number | null; itemCode: string; itemName: string;
  retailPrice: number; quantity: number; manager: string; mode?: 'mark' | 'set';
}): Promise<void> {
  const kstMidnight = new Date(`${todayKst()}T00:00:00+09:00`).toISOString();
  const { data: existing } = await supabase.from('sommelier_orders')
    .select('id').eq('customer_id', o.customerId).eq('item_code', o.itemCode)
    .gte('created_at', kstMidnight).order('created_at', { ascending: false }).limit(1);
  const prev = existing?.[0];

  if (prev) {
    if (o.mode !== 'set') return; // 표시만 — 이미 기록됨
    const { error } = await supabase.from('sommelier_orders').update({
      retail_price: o.retailPrice, quantity: o.quantity, manager: o.manager,
      ...(o.sessionId ? { session_id: o.sessionId } : {}),
    }).eq('id', prev.id);
    if (error) throw new Error(`구매 기록 실패: ${error.message}`);
    return;
  }

  const { error } = await supabase.from('sommelier_orders').insert({
    customer_id: o.customerId, session_id: o.sessionId,
    item_code: o.itemCode, item_name: o.itemName,
    retail_price: o.retailPrice, quantity: o.quantity, manager: o.manager,
  });
  if (error) throw new Error(`구매 기록 실패: ${error.message}`);
}

/** 보유기간(마지막 방문 3년) 경과 고객 파기 — 세션·구매 기록은 FK CASCADE로 함께 삭제. 반환=대상 수 */
export async function purgeInactiveSommelierCustomers(dryRun = false): Promise<number> {
  const { data, error } = await supabase.rpc('purge_inactive_sommelier_customers', { p_years: 3, p_dry_run: dryRun });
  if (error) throw new Error(`보유기간 파기 실패: ${error.message}`);
  return Number(data) || 0;
}
