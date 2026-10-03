// 재방문 환영(손님 앞) — 손님 정보 화면에서 재방문 손님을 골랐을 때(손님 앞 화면): 지난 와인·추천 답변만. 금액·메모 없음.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf } from '@/app/lib/store/scope';
import { customerScopeOf, loadWelcome } from '@/app/lib/sommelierCustomerCard';
import { handleApiError } from '@/app/lib/errors';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !storeViewOf(session)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '잘못된 손님입니다.' }, { status: 400 });
    const w = await loadWelcome(id, customerScopeOf(session));
    if (!w) return NextResponse.json({ error: '손님 정보를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(w);
  } catch (e) {
    return handleApiError(e);
  }
}
