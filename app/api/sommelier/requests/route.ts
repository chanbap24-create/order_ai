// 소믈리에 수정 요청 — POST: 매장 직원 누구나 / GET·PATCH: 소믈리에 관리자(박경아·조성재·admin)만.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { canEditDiscounts } from '@/app/lib/sommelierDiscount';
import {
  createChangeRequest, listChangeRequests, setChangeRequestStatus,
  REQUEST_CATEGORIES, type RequestCategory,
} from '@/app/lib/sommelierRequests';
import { handleApiError } from '@/app/lib/errors';
import { storeViewOf } from '@/app/lib/store/scope';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const b = await req.json();
    const itemNo = typeof b?.itemNo === 'string' ? b.itemNo.trim() : '';
    const category = b?.category as RequestCategory;
    const message = typeof b?.message === 'string' ? b.message.trim().slice(0, 500) : '';
    if (!itemNo || !(category in REQUEST_CATEGORIES)) {
      return NextResponse.json({ error: '품목과 요청 유형이 필요합니다.' }, { status: 400 });
    }
    if (category === 'other' && !message) {
      return NextResponse.json({ error: '기타 요청은 내용을 적어주세요.' }, { status: 400 });
    }
    const request = await createChangeRequest({
      itemNo, itemName: typeof b?.itemName === 'string' ? b.itemName.slice(0, 100) : '',
      category, message, storeKey: storeViewOf(session), // 요청 매장 = 세션 기준
      requester: session.manager,
    });
    return NextResponse.json({ request });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!canEditDiscounts(session)) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    return NextResponse.json({ requests: await listChangeRequests() });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canEditDiscounts(session)) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    const b = await req.json();
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    await setChangeRequestStatus(id, b?.done !== false, session.manager);
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
