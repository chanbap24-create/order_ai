import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { buildCandidates } from './lib/buildCandidates';

export async function POST(req: Request) {
  try {
    const { client_code, price_band } = await req.json();
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
    const { client, scored, summary } = await buildCandidates(client_code, band);
    const recommendations = scored.slice(0, 30);

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
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `추천 생성 중 오류: ${msg}` }, { status: 500 });
  }
}
