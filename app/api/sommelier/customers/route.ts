// 고객 목록(매장 앱 메뉴 '고객') — 이름 일부 검색. 박경아·조성재·admin은 전체, 그 외 계정은 본인이 등록한 고객만.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf } from '@/app/lib/store/scope';
import { customerScopeOf, listCustomers } from '@/app/lib/sommelierCustomerCard';
import { handleApiError } from '@/app/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !storeViewOf(session)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const q = (req.nextUrl.searchParams.get('q') || '').slice(0, 30);
    return NextResponse.json({ customers: await listCustomers(customerScopeOf(session), q) });
  } catch (e) {
    return handleApiError(e);
  }
}
