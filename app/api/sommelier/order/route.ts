// 손님 구매 와인 기록 — 향후 고객별 자동추천의 학습 데이터. 세일즈 세션 필요.
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { deleteOrder, saveOrder } from '@/app/lib/sommelierDb';
import { handleApiError } from '@/app/lib/errors';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const b = await req.json();
    const customerId = Number(b?.customerId);
    const itemCode = typeof b?.itemCode === 'string' ? b.itemCode.trim() : '';
    if (!customerId || !itemCode) {
      return NextResponse.json({ error: '고객과 와인 정보가 필요합니다.' }, { status: 400 });
    }
    await saveOrder({
      customerId,
      sessionId: Number(b?.sessionId) || null,
      itemCode,
      itemName: typeof b?.itemName === 'string' ? b.itemName.slice(0, 100) : '',
      retailPrice: Number(b?.retailPrice) || 0,
      quantity: Math.max(1, Number(b?.quantity) || 1),
      manager: session.manager,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const b = await req.json();
    const customerId = Number(b?.customerId);
    const itemCode = typeof b?.itemCode === 'string' ? b.itemCode.trim() : '';
    if (!customerId || !itemCode) {
      return NextResponse.json({ error: '고객과 와인 정보가 필요합니다.' }, { status: 400 });
    }
    await deleteOrder(customerId, itemCode, Number(b?.sessionId) || null);
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
