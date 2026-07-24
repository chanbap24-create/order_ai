// 소믈리에 고객 등록/조회 — 성함+핸드폰 upsert. 세일즈 세션 필요.
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { upsertCustomer } from '@/app/lib/sommelierDb';
import { normalizePhone } from '@/app/sommelier/lib/quiz';
import { handleApiError } from '@/app/lib/errors';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const { name, phone } = await req.json();
    const nm = typeof name === 'string' ? name.trim() : '';
    const ph = normalizePhone(typeof phone === 'string' ? phone : '');
    if (!nm || nm.length > 30) return NextResponse.json({ error: '성함을 확인해주세요.' }, { status: 400 });
    if (!ph) return NextResponse.json({ error: '핸드폰 번호를 확인해주세요.' }, { status: 400 });
    const customer = await upsertCustomer(nm, ph);
    return NextResponse.json({ customer });
  } catch (e) {
    return handleApiError(e);
  }
}
