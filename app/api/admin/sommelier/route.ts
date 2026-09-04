// 소믈리에 고객·문답·구매 이력 조회/삭제 (어드민)
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  try {
    const [{ data: customers }, { data: sessions }, { data: orders }] = await Promise.all([
      supabase.from('sommelier_customers').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('sommelier_sessions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('sommelier_orders').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    return NextResponse.json({ customers: customers || [], sessions: sessions || [], orders: orders || [] });
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
