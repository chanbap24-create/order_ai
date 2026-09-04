// 백화점 취향 문답 추천 — 세일즈 세션 필요. 고객이 지정되면 문답 세션도 기록.
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { recommendForCustomer } from '@/app/lib/sommelierRecommend';
import { saveSession } from '@/app/lib/sommelierDb';
import { EMPTY_ANSWERS, type QuizAnswers } from '@/app/sommelier/lib/quiz';
import { handleApiError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const body = await req.json();
    const a: QuizAnswers = { ...EMPTY_ANSWERS, ...(body?.answers || {}) };
    if (!Array.isArray(a.flavorGroups)) a.flavorGroups = [];
    if (!Array.isArray(a.flavors)) a.flavors = [];
    if (!Array.isArray(a.countries)) a.countries = [];
    const store = typeof body?.store === 'string' ? body.store : 'all';
    const results = await recommendForCustomer(a, 20, store); // 화면은 5병 + 더보기

    // 빈 결과 + 가격대 지정 시: 가격을 풀면 몇 병인지 힌트 (직원의 다음 제안용)
    let priceHint: { count: number; minPrice: number } | null = null;
    if (results.length === 0 && (a.priceMin != null || a.priceMax != null)) {
      const relaxed = await recommendForCustomer({ ...a, priceMin: null, priceMax: null }, 50, store);
      if (relaxed.length > 0) {
        priceHint = { count: relaxed.length, minPrice: Math.min(...relaxed.map((r) => r.retail_price)) };
      }
    }

    // 고객 문답 이력 저장 (실패해도 추천 자체는 반환)
    let sessionId: number | null = null;
    const customerId = Number(body?.customerId) || null;
    if (customerId) {
      try {
        sessionId = await saveSession(customerId, session.manager, a, results.slice(0, 5));
      } catch (e) {
        logger.warn(`[sommelier] 세션 저장 실패: ${e instanceof Error ? e.message : e}`);
      }
    }
    return NextResponse.json({ results, sessionId, priceHint });
  } catch (e) {
    return handleApiError(e);
  }
}
