// 단골 카드 — GET: 카드 데이터 / PATCH: 직원 메모 저장. 박경아·조성재·admin은 전체, 그 외 계정은 본인이 등록한 고객만.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf } from '@/app/lib/store/scope';
import { canViewCustomer, customerScopeOf, loadCustomerCard, saveCustomerMemo } from '@/app/lib/sommelierCustomerCard';
import { handleApiError } from '@/app/lib/errors';

async function guard(params: Promise<{ id: string }>) {
  const session = await getSession();
  if (!session || !storeViewOf(session)) return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return { error: NextResponse.json({ error: '잘못된 손님입니다.' }, { status: 400 }) };
  if (!(await canViewCustomer(customerScopeOf(session), id))) return { error: NextResponse.json({ error: '본인이 등록한 고객만 볼 수 있습니다.' }, { status: 403 }) };
  return { id, session };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const card = await loadCustomerCard(g.id);
    if (!card) return NextResponse.json({ error: '손님 정보를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ card });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const b = await req.json();
    await saveCustomerMemo(g.id, typeof b?.memo === 'string' ? b.memo : '', g.session.manager);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
