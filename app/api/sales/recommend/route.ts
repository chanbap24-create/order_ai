import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { buildCandidates } from './lib/buildCandidates';
import { orderForDisplay, DEFAULT_SCORE_PARAMS, type ScoreParams } from './lib/scoring';

/** 화면에서 온 점수 가중치를 숫자만 클램프해 안전화(없으면 undefined → 기본값 사용). */
function parseScoreParams(raw: unknown): ScoreParams | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const d = DEFAULT_SCORE_PARAMS;
  const num = (v: unknown, def: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const tb = Array.isArray(r.tierBase) ? r.tierBase : d.tierBase;
  return {
    tierBase: [0, 1, 2, 3].map((i) => num(tb[i], d.tierBase[i], 0, 300)) as [number, number, number, number],
    softWeight: num(r.softWeight, d.softWeight, 0, 100),
    velocityWeight: num(r.velocityWeight, d.velocityWeight, 0, 100),
    recentPenalty: num(r.recentPenalty, d.recentPenalty, 0, 1),
    convBoost: num(r.convBoost, d.convBoost, 0, 100),
    noconvPenalty: num(r.noconvPenalty, d.noconvPenalty, 0, 1),
    quoteFeedbackWeight: num(r.quoteFeedbackWeight, d.quoteFeedbackWeight, 0, 100),
    venueWeight: num(r.venueWeight, d.venueWeight, 0, 100),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_code, price_band, profile_months, geo_ceiling, freq_strength, stock_months, min_stock, score_params, popularity_weight, mode: modeRaw, anchor_item_code, anchor_price, discovery_types, discovery_min_price, discovery_max_price, discovery_segment, include_nonstandard, discount_apply, discount_scope } = body;
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
    // score_params: 화면에서 조절한 점수 가중치 — 숫자만 클램프해 전달(없으면 기본값)
    const scoreParams = parseScoreParams(score_params);
    // popularity_weight: 인기 prior 블렌드 α(0~1, 0=미적용)
    const popularityWeight = Math.min(1, Math.max(0, Number(popularity_weight) || 0));

    // 추천 타입: new(신규제안) | substitute(대체상품) | discovery(발굴/신규).
    const mode = modeRaw === 'substitute' ? 'substitute' : modeRaw === 'discovery' ? 'discovery' : 'new';
    const anchorItemCode = mode === 'substitute' && typeof anchor_item_code === 'string' && anchor_item_code ? anchor_item_code : undefined;
    if (mode === 'substitute' && !anchorItemCode) {
      return NextResponse.json({ error: '대체상품 모드는 기준 상품(쇼트난 품목)을 선택해야 합니다.' }, { status: 400 });
    }
    const anchorPrice = Number.isFinite(Number(anchor_price)) && Number(anchor_price) > 0 ? Number(anchor_price) : undefined;

    // 발굴 모드 파라미터 — 타입 버킷 화이트리스트, 가격 정수, 업태 문자열
    const TYPE_BUCKETS = ['sparkling', 'fortified', 'rose', 'white', 'red'];
    const discoveryTypes = Array.isArray(discovery_types)
      ? discovery_types.filter((t: unknown): t is string => typeof t === 'string' && TYPE_BUCKETS.includes(t))
      : undefined;
    const dMin = Number(discovery_min_price); const dMax = Number(discovery_max_price);
    const discoveryMinPrice = Number.isFinite(dMin) && dMin > 0 ? Math.round(dMin) : undefined;
    const discoveryMaxPrice = Number.isFinite(dMax) && dMax > 0 ? Math.round(dMax) : undefined;
    const discoverySegment = typeof discovery_segment === 'string' && discovery_segment.trim() ? discovery_segment.trim().slice(0, 40) : undefined;

    const { client, scored, summary } = await buildCandidates(client_code, {
      mode,
      ...(anchorItemCode ? { anchorItemCode } : {}),
      ...(anchorPrice ? { anchorPrice } : {}),
      ...(discoveryTypes && discoveryTypes.length ? { discoveryTypes } : {}),
      ...(discoveryMinPrice ? { discoveryMinPrice } : {}),
      ...(discoveryMaxPrice ? { discoveryMaxPrice } : {}),
      ...(discoverySegment ? { discoverySegment } : {}),
      ...(include_nonstandard ? { includeNonStandard: true } : {}),
      discountApply: discount_apply !== false,
      discountScope: discount_scope === 'rest' ? 'rest' : 'team1',
      priceBandPct: band, profileMonths: months,
      geoCeiling: geoCeiling as 'super' | 'country' | 'any',
      freqStrength: freqStrength as 'strong' | 'soft' | 'off',
      stockMonths,
      ...(minStock && Object.keys(minStock).length ? { minStock: minStock as never } : {}),
      ...(scoreParams ? { scoreParams } : {}),
      ...(popularityWeight > 0 ? { popularityWeight } : {}),
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
