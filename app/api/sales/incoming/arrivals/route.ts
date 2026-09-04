// 최근 통관 완료된 대기 품목 — 브리핑 섹션용 (팝업 확인 후에도 14일 유지)
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { listRecentArrivals } from '@/app/lib/incomingRequests';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    return NextResponse.json({ arrivals: await listRecentArrivals(session.manager) });
  } catch (e) {
    return handleApiError(e);
  }
}
