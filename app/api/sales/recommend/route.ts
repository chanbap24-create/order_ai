import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { buildCandidates } from './lib/buildCandidates';
import { orderForDisplay } from './lib/scoring';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_code, price_band, profile_months, geo_ceiling, freq_strength, stock_months, min_stock } = body;
    if (!client_code) {
      return NextResponse.json({ error: 'client_code가 필요합니다.' }, { status: 400 });
    }
    if (!isValidClientCode(client_code)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }

    // IDOR 방어
    const accessCheck = await requireClientAccess(client_code);
    if (accessCheck) return accessCheck;

    // 영업사원 설정(추천견적 탭) — 모두 클램프/검증
    const band = Math.min(1, Math.max(0.05, Number(price_band) || 0.2));
    const months = Math.min(36, Math.max(1, Math.round(Number(profile_months) || 6)));
    const geoCeiling = ['super', 'country', 'any'].includes(geo_ceiling) ? geo_ceiling : 'super';
    const freqStrength = ['strong', 'soft', 'off'].includes(freq_strength) ? freq_strength : 'strong';
    const stockMonths = Math.min(12, Math.max(0, Number(stock_months ?? 1)));
    // min_stock: 6개 가격대 정수만 추려 전달(없으면 기본값 사용)
    let minStock: Record<string, number> | undefined;
    if (min_stock && typeof min_stock === 'object') {
      minStock = {};
      for (const k of ['price_300k', 'price_200k', 'price_100k', 'price_50k', 'price_20k', 'price_under_20k']) {
        const v = Number((min_stock as Record<string, unknown>)[k]);
        if (Number.isFinite(v) && v >= 0) minStock[k] = Math.round(v);
      }
    }
    const { client, scored, summary } = await buildCandidates(client_code, {
      priceBandPct: band, profileMonths: months,
      geoCeiling: geoCeiling as 'super' | 'country' | 'any',
      freqStrength: freqStrength as 'strong' | 'soft' | 'off',
      stockMonths,
      ...(minStock && Object.keys(minStock).length ? { minStock: minStock as never } : {}),
    });
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
