import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

// 수금 워크플로우(독촉 단계·약속일·메모) — collection_followups CRUD.
// 거래처별 1행(client_code+client_type) upsert. 까브드뱅/대유라이프 분리.

const isAdmin = (role: string) => role === 'admin' || role === 'executive' || role === 'sales_admin';

// GET /api/sales/collections?manager=XXX&type=wine → 해당 매니저의 followup 목록
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clientType = searchParams.get('type') === 'glass' ? 'glass' : 'wine';
    // 일반 영업자는 본인 것만, 관리자는 지정 매니저.
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;

    const { data, error } = await supabase
      .from('collection_followups')
      .select('client_code, client_type, stage, status, promised_date, memo, updated_at')
      .eq('manager', manager)
      .eq('client_type', clientType);
    if (error) throw error;
    return NextResponse.json({ followups: data || [] });
  } catch (err) {
    console.error('GET /api/sales/collections error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT /api/sales/collections — { client_code, client_type, manager?, stage?, status?, promised_date?, memo? }
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const body = await req.json();
    const clientCode = String(body.client_code || '').trim();
    const clientType = body.client_type === 'glass' ? 'glass' : 'wine';
    if (!clientCode) return NextResponse.json({ error: 'client_code required' }, { status: 400 });

    // 매니저: 관리자는 body 지정 가능, 일반 영업자는 본인.
    const manager = isAdmin(session.role) ? (body.manager || session.manager) : session.manager;

    const row = {
      client_code: clientCode,
      client_type: clientType,
      manager,
      stage: Number.isFinite(body.stage) ? Math.max(0, Math.min(3, Math.trunc(body.stage))) : 0,
      status: ['open', 'promised', 'paid', 'hold'].includes(body.status) ? body.status : 'open',
      promised_date: body.promised_date || null,
      memo: typeof body.memo === 'string' ? body.memo.slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
      updated_by: session.manager,
    };

    const { data, error } = await supabase
      .from('collection_followups')
      .upsert(row, { onConflict: 'client_code,client_type' })
      .select('client_code, client_type, stage, status, promised_date, memo, updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ followup: data });
  } catch (err) {
    console.error('PUT /api/sales/collections error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
