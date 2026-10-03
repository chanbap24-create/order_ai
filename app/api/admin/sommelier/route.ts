// 소믈리에 고객·문답·구매 이력 조회/삭제 (어드민)
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';
import { buildTastes, type CustomerRow, type OrderRow, type SessionRow } from '@/app/lib/sommelierExport/data';

export async function GET() {
  try {
    const [{ data: customers }, { data: sessions }, { data: orders }] = await Promise.all([
      supabase.from('sommelier_customers').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('sommelier_sessions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('sommelier_orders').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    // 손님별 취향 요약(방문·구매·맛 평균·선호) — 엑셀 내보내기와 같은 계산(buildTastes) 재사용
    const tastes = Object.fromEntries(
      buildTastes((customers || []) as CustomerRow[], (orders || []) as OrderRow[], (sessions || []) as SessionRow[])
        .map(({ customer, ...t }) => [customer.id, t]),
    );
    return NextResponse.json({ customers: customers || [], sessions: sessions || [], orders: orders || [], tastes });
  } catch (e) {
    return handleApiError(e);
  }
}

/** 고객 삭제 — 문답 세션·구매 기록까지 함께 제거 */
export async function DELETE(req: Request) {
  try {
    const { customerId } = await req.json();
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'customerId가 필요합니다.' }, { status: 400 });
    }
    await supabase.from('sommelier_orders').delete().eq('customer_id', id);
    await supabase.from('sommelier_sessions').delete().eq('customer_id', id);
    const { error } = await supabase.from('sommelier_customers').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
