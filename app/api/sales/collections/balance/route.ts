import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { isValidClientCode, isValidDate } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';

// GET /api/sales/collections/balance?client_code=X&type=wine&date=YYYY-MM-DD
// 해당 날짜까지 만기도래한 연체액(없으면 전체 미수) — 수금일 변경 시 약속 금액 재계산용.
// 결제조건(익월말 등)을 반영하므로, 아직 만기 전인 금액은 제외된다.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('client_code') || '').trim();
    const type = searchParams.get('type') === 'glass' ? 'glass' : 'wine';
    const date = searchParams.get('date') || '';
    if (!code || !date) return NextResponse.json({ error: 'client_code, date required' }, { status: 400 });
    if (!isValidClientCode(code)) return NextResponse.json({ error: 'Invalid client_code' }, { status: 400 });
    if (!isValidDate(date)) return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 400 });

    // IDOR 방어: 본인(담당) 거래처만 — ledger 라우트와 동일 정책
    const access = await requireClientAccess(code, type as 'wine' | 'glass');
    if (access) return access;

    const { data, error } = await supabase.rpc('fn_client_due_amount_at', { p_code: code, p_type: type, p_date: date });
    if (error) throw error;
    return NextResponse.json({ balance: data ?? 0 });
  } catch (err) {
    console.error('GET /api/sales/collections/balance error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
