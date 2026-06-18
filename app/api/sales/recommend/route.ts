import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { buildCandidates } from './lib/buildCandidates';
import { orderForDisplay } from './lib/scoring';

export async function POST(req: Request) {
  try {
    const { client_code, price_band, profile_months } = await req.json();
    if (!client_code) {
      return NextResponse.json({ error: 'client_code가 필요합니다.' }, { status: 400 });
    }
    if (!isValidClientCode(client_code)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }

    // IDOR 방어
    const accessCheck = await requireClientAccess(client_code);
    if (accessCheck) return accessCheck;

    // 가격 밴드 ±%(슬라이더). 0.05~1.0 로 클램프, 기본 0.2
    const band = Math.min(1, Math.max(0.05, Number(price_band) || 0.2));
    // 분석 기간(개월). 1~36 클램프, 기본 6
    const months = Math.min(36, Math.max(1, Math.round(Number(profile_months) || 6)));
    const { client, scored, summary } = await buildCandidates(client_code, band, months);
    // 관련도 점수로 상위 선별 후, 견적 표시 순서(스파클링→화이트→레드 · 타입내 공급가 내림차순)로 정렬
    const recommendations = orderForDisplay(scored.slice(0, 30));

    // 이력 저장
    if (recommendations.length > 0) {
      await supabase.from('recommendations').insert({
        client_code,
        item_codes: recommendations.map((i) => i.item_no),
        reason: `AI 추천 ${recommendations.length}개 (산지+점수 기반)`,
        recommendation_type: 'ai_score',
        status: 'pending',
      });
    }

    return NextResponse.json({ client, recommendations, summary });
  } catch (error) {
    console.error('Recommend API error:', error);
    return NextResponse.json({ error: '추천 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
