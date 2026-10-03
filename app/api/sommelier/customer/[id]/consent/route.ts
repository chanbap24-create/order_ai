// 재방문 손님 동의 갱신(손님 앞 화면) — 수집 항목 재동의 / 광고성 수신 동의·철회. 매장 앱 계정이면 누구나(손님은 다른 직원에게도 옴).
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf } from '@/app/lib/store/scope';
import { updateCustomerConsent } from '@/app/lib/sommelierDb';
import { handleApiError } from '@/app/lib/errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !storeViewOf(session)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '잘못된 손님입니다.' }, { status: 400 });
    const b = await req.json();
    await updateCustomerConsent(id, {
      consent: b?.consent === true,
      marketing: typeof b?.marketing === 'boolean' ? b.marketing : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
