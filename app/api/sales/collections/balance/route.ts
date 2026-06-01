import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

// GET /api/sales/collections/balance?client_code=X&type=wine&date=YYYY-MM-DD
// 해당 날짜 기준 미수 잔액 (수금일 변경 시 약속 금액 재계산용).
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('client_code') || '').trim();
    const type = searchParams.get('type') === 'glass' ? 'glass' : 'wine';
    const date = searchParams.get('date') || '';
    if (!code || !date) return NextResponse.json({ error: 'client_code, date required' }, { status: 400 });

    const { data, error } = await supabase.rpc('fn_client_balance_at', { p_code: code, p_type: type, p_date: date });
    if (error) throw error;
    return NextResponse.json({ balance: data ?? 0 });
  } catch (err) {
    console.error('GET /api/sales/collections/balance error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
