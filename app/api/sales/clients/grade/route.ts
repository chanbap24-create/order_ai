// 거래처 등급·혜택 요약 — 거래처 정보 화면용.
// 직전 완료 분기 지표로 등급 판정 + 다음 등급 조건 + 현재 할인 혜택(가격공식).
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { prevQuarterRange, currentQuarterRange } from '@/app/lib/pricing/quarters';
import { computeQuarterMetrics, gradeProgress } from '@/app/lib/pricing/clientGrade';
import { venueKeyToCategory } from '@/app/lib/pricing/venueCategory';
import { getDiscountConfig } from '@/app/lib/pricing/discountConfig';
import { buildPricingContext } from '@/app/api/sales/recommend/lib/formulaDiscount';
import { computeItemDiscount } from '@/app/lib/pricing/discountRate';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const code = req.nextUrl.searchParams.get('client_code') || '';
    if (!code) return NextResponse.json({ error: 'client_code 필요' }, { status: 400 });

    // 업태 카테고리 = 업장 유형 태그 기준(retail=샵 / wholesale=도매 / 그 외=업소·호텔)
    const { data: v } = await supabase.from('client_venue').select('venue')
      .eq('client_code', code).eq('client_type', 'wine').maybeSingle();
    const category = venueKeyToCategory(v?.venue);

    // 직전 완료 분기 출고
    const range = prevQuarterRange();
    const { data: ships } = await supabase.from('shipments')
      .select('item_no, quantity, ship_date')
      .eq('client_code', code).gte('ship_date', range.start).lt('ship_date', range.end)
      .limit(5000);

    // 품번별 공급가(등급 매출 = Σ 공급가×수량)
    const itemNos = [...new Set((ships || []).map((s) => s.item_no).filter(Boolean))];
    const priceMap = new Map<string, number>();
    for (let i = 0; i < itemNos.length; i += 300) {
      const { data: inv } = await supabase.from('inventory_cdv')
        .select('item_no, supply_price').in('item_no', itemNos.slice(i, i + 300));
      for (const r of (inv || [])) priceMap.set(r.item_no, Number(r.supply_price) || 0);
    }
    const priceOf = (no: string) => priceMap.get(no) || 0;

    const metrics = computeQuarterMetrics(ships || [], priceOf, range);
    const prog = gradeProgress(category, metrics);

    // ── 이번 분기(진행 중) 실적 — '다음 등급 도전' 트랙용. 목표 문턱 = 현 등급+1. ──
    const curRange = currentQuarterRange();
    const { data: curShips } = await supabase.from('shipments')
      .select('item_no, quantity, ship_date')
      .eq('client_code', code).gte('ship_date', curRange.start).lt('ship_date', curRange.end)
      .limit(5000);
    const curItemNos = [...new Set((curShips || []).map((s) => s.item_no).filter(Boolean))]
      .filter((no) => !priceMap.has(no));
    for (let i = 0; i < curItemNos.length; i += 300) {
      const { data: inv } = await supabase.from('inventory_cdv')
        .select('item_no, supply_price').in('item_no', curItemNos.slice(i, i + 300));
      for (const r of (inv || [])) priceMap.set(r.item_no, Number(r.supply_price) || 0);
    }
    const curMetrics = computeQuarterMetrics(curShips || [], priceOf, curRange);
    // 이번 분기 현재값 + 목표(현 등급의 다음 문턱)
    const challenge = gradeProgress(category, curMetrics).metrics.map((m) => ({
      ...m,
      next: prog.grade < 4 ? m.thresholds[prog.grade] : null,
    }));
    const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(curRange.end).getTime() - new Date(todayStr).getTime()) / 86400000,
    ));

    // 현재 혜택(할인율) — 거래처 단위(기본+매출등급+리델). 수량가산은 주문 시 별도.
    const config = await getDiscountConfig('CDV');
    const ctx = await buildPricingContext(code, category, metrics, config);
    const disc = computeItemDiscount(ctx, { supplyPrice: 100000, qty: 1 });
    // 할인 보정(매출등급 1단계업) 적용 시 할인율 — 추천견적 토글의 미리보기용
    const discStepUp = computeItemDiscount(
      { ...ctx, salesGradeStepUp: true }, { supplyPrice: 100000, qty: 1 });

    // 다음 매출 구간(할인 가산) — '이번 분기' 매출 기준(마감까지 채우면 다음 분기 할인↑)
    const salesTiers = category === 'shop' ? config.shop.sales : category === 'venue' ? config.venue.sales : [];
    const nextSalesTier = salesTiers
      .filter((t) => curMetrics.salesSupply < t.min)
      .sort((a, b) => a.min - b.min)[0] || null;

    // 할인 등급 도전 트랙(엑셀 A표) — 이번 분기 매출 + (업소/호텔) 리스팅 품목수
    const asc = (ts: Array<{ min: number; add: number }>) => [...ts].sort((a, b) => a.min - b.min);
    const discountChallenge = {
      sales: salesTiers.length ? { cur: curMetrics.salesSupply, tiers: asc(salesTiers) } : null,
      listing: category === 'venue' ? { cur: curMetrics.itemCount, tiers: asc(config.venue.listing) } : null,
    };

    return NextResponse.json({
      category,
      grade: prog.grade,
      metrics: prog.metrics,
      quarter: { start: range.start, end: range.end },
      // 다음 등급 도전(이번 분기): 지표별 현재/목표 + 마감 정보
      challenge: {
        metrics: challenge,
        quarter: { start: curRange.start, end: curRange.end },
        daysLeft,
        appliesFrom: curRange.end, // 달성 시 이 날짜부터 새 등급 적용(다음 분기 시작)
      },
      benefit: { rate: disc.rate, breakdown: disc.breakdown, riedel: ctx.hadRiedelLastQuarter },
      benefitStepUp: { rate: discStepUp.rate, breakdown: discStepUp.breakdown },
      nextSalesTier: nextSalesTier
        ? { min: nextSalesTier.min, add: nextSalesTier.add, remain: nextSalesTier.min - curMetrics.salesSupply }
        : null,
      discountChallenge,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
