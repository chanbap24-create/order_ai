import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { parseOrderV3 } from '@/app/lib/matcher-v3/parseOrder';
import { handleApiError } from '@/app/lib/errors';

// 발주 v3 — 추출(Claude) → 매칭(matchLineV3). 와인(CDV) 전용.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { order_text, client_code } = await req.json();
    if (!order_text?.trim()) return NextResponse.json({ error: '발주 내용을 입력해주세요.' }, { status: 400 });
    if (typeof order_text !== 'string' || order_text.length > 5000) {
      return NextResponse.json({ error: '발주 내용이 너무 깁니다. (최대 5000자)' }, { status: 400 });
    }

    const result = await parseOrderV3(order_text, client_code || null);
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
