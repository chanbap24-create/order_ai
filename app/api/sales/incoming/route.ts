// 입고 예정 와인 대기 등록 — 목록/등록/해제
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { listIncomingItems, addRequest, removeRequest } from '@/app/lib/incomingRequests';
import { handleApiError } from '@/app/lib/errors';

const isAdmin = (r: string) => r === 'admin' || r === 'executive' || r === 'sales_admin';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const items = await listIncomingItems(session.manager, isAdmin(session.role));
    return NextResponse.json({ items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const b = await req.json();
    const itemCode = String(b.itemCode || '').trim();
    const clientName = String(b.clientName || '').trim().slice(0, 50);
    if (!itemCode || !clientName) {
      return NextResponse.json({ error: '품목과 거래처명을 확인해주세요.' }, { status: 400 });
    }
    const request = await addRequest({
      itemCode,
      itemName: String(b.itemName || '').slice(0, 100),
      clientCode: b.clientCode ? String(b.clientCode) : null,
      clientName,
      manager: session.manager,
      memo: b.memo ? String(b.memo).slice(0, 200) : undefined,
    });
    return NextResponse.json({ request });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!Number.isInteger(Number(id))) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    await removeRequest(Number(id), session.manager, isAdmin(session.role));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
