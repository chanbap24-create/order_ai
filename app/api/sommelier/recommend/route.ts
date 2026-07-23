// 백화점 취향 문답 추천 — 세일즈 세션 필요. 로직은 app/lib/sommelierRecommend.ts.
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { recommendForCustomer } from '@/app/lib/sommelierRecommend';
import { EMPTY_ANSWERS, type QuizAnswers } from '@/app/sommelier/lib/quiz';
import { handleApiError } from '@/app/lib/errors';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const body = await req.json();
    const a: QuizAnswers = { ...EMPTY_ANSWERS, ...(body?.answers || {}) };
    if (!Array.isArray(a.flavorGroups)) a.flavorGroups = [];
    const results = await recommendForCustomer(a, 5);
    return NextResponse.json({ results });
  } catch (e) {
    return handleApiError(e);
  }
}
