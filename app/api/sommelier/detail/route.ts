// 결과 카드 전체화면 상세용 테이스팅 노트 조회
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { loadSommelierDetail } from '@/app/lib/sommelierDetail';
import { handleApiError } from '@/app/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const code = req.nextUrl.searchParams.get('code') || '';
    if (!code) return NextResponse.json({ error: 'code가 필요합니다.' }, { status: 400 });
    return NextResponse.json({ detail: await loadSommelierDetail(code) });
  } catch (e) {
    return handleApiError(e);
  }
}
