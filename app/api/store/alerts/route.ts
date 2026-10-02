// 매장 앱 입고 알림 — GET: 내 알림(조회 시 입고 판정) / POST: 신청 / PATCH: 연락 완료·취소. 본인 건만.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { createRestockAlert, listMyAlerts, updateMyAlert } from '@/app/lib/store/restockAlerts';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    return NextResponse.json({ alerts: await listMyAlerts(session.manager) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const b = await req.json();
    const itemNo = typeof b?.itemNo === 'string' ? b.itemNo.trim() : '';
    const customerId = Number(b?.customerId);
    if (!itemNo || !Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json({ error: '와인과 손님이 필요합니다.' }, { status: 400 });
    }
    const res = await createRestockAlert({
      storeKey: typeof b?.storeKey === 'string' ? b.storeKey : '', itemNo,
      itemName: typeof b?.itemName === 'string' ? b.itemName : '', customerId, staff: session.manager,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const b = await req.json();
    const id = Number(b?.id);
    const action = b?.action === 'done' || b?.action === 'cancel' ? b.action : null;
    if (!Number.isInteger(id) || !action) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    await updateMyAlert(id, session.manager, action);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
