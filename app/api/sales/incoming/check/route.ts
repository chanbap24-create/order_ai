// 통관 완료된 대기 품목 확인/팝업 확인 처리
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { checkArrivals, ackArrivals } from '@/app/lib/incomingRequests';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    return NextResponse.json({ notices: await checkArrivals(session.manager) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const { itemCodes } = await req.json();
    await ackArrivals(session.manager, Array.isArray(itemCodes) ? itemCodes.map(String) : []);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
