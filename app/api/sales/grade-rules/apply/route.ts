import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

interface RuleThresholds {
  vip_threshold: number;
  important_threshold: number;
  normal_threshold: number;
  occasional_threshold: number;
  listing_vip: number;
  listing_important: number;
  listing_normal: number;
  listing_occasional: number;
  listing_months: number;
  business_type: string;
}

function gradeFromSales(sales: number, rule: RuleThresholds): number {
  if (sales >= rule.vip_threshold) return 1;
  if (sales >= rule.important_threshold) return 2;
  if (sales >= rule.normal_threshold) return 3;
  if (sales >= rule.occasional_threshold) return 4;
  return 5;
}

function gradeFromListings(count: number, rule: RuleThresholds): number {
  if (count >= rule.listing_vip) return 1;
  if (count >= rule.listing_important) return 2;
  if (count >= rule.listing_normal) return 3;
  if (count >= rule.listing_occasional) return 4;
  return 5;
}

// POST: 등급 기준을 적용하여 client_details.importance 자동 업데이트
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { manager, client_type } = body;

    if (!manager) {
      return NextResponse.json({ error: 'manager is required' }, { status: 400 });
    }

    const type = client_type || 'wine';
    const shipmentsTable = type === 'glass' ? 'glass_shipments' : 'shipments';

    // 1. 등급 기준 조회: 업종별 규칙 전부 가져오기
    const { data: allRules } = await supabase
      .from('grade_rules')
      .select('*')
      .or(`manager.eq.${manager},manager.eq._default`)
      .eq('client_type', type);

    // 업종별 규칙 맵 구축 (담당 우선 > _default 폴백)
    const ruleMap = new Map<string, RuleThresholds>();
    // 먼저 _default 로드
    for (const r of (allRules || [])) {
      if (r.manager === '_default') {
        ruleMap.set(r.business_type || '_all', r as RuleThresholds);
      }
    }
    // 담당 규칙으로 덮어쓰기
    for (const r of (allRules || [])) {
      if (r.manager === manager) {
        ruleMap.set(r.business_type || '_all', r as RuleThresholds);
      }
    }

    // 폴백 기본값
    const fallbackRule: RuleThresholds = ruleMap.get('_all') || {
      vip_threshold: type === 'glass' ? 50000000 : 100000000,
      important_threshold: type === 'glass' ? 20000000 : 50000000,
      normal_threshold: type === 'glass' ? 5000000 : 10000000,
      occasional_threshold: type === 'glass' ? 500000 : 1000000,
      listing_vip: type === 'glass' ? 10 : 15,
      listing_important: type === 'glass' ? 7 : 10,
      listing_normal: type === 'glass' ? 3 : 5,
      listing_occasional: type === 'glass' ? 1 : 2,
      listing_months: 6,
      business_type: '_all',
    };

    // 2. 해당 담당의 거래처 코드 목록 (shipments에서)
    const clientCodes = new Set<string>();
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from(shipmentsTable)
        .select('client_code')
        .eq('manager', manager)
        .not('client_code', 'is', null)
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (r.client_code) clientCodes.add(r.client_code);
      }
      if (data.length < batchSize) break;
      from += batchSize;
    }

    if (clientCodes.size === 0) {
      return NextResponse.json({ success: true, updated: 0, message: '해당 담당의 거래처가 없습니다' });
    }

    const codes = Array.from(clientCodes);

    // 3. 거래처별 업종 조회
    const bizTypeMap: Record<string, string> = {};
    for (let i = 0; i < codes.length; i += 100) {
      const batch = codes.slice(i, i + 100);
      const { data } = await supabase
        .from('client_details')
        .select('client_code, business_type')
        .in('client_code', batch);

      for (const d of (data || [])) {
        bizTypeMap[d.client_code] = d.business_type || '_all';
      }
    }

    // 4. 최근 1년 매출 집계
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveStr = twelveMonthsAgo.toISOString().slice(0, 10);

    const salesMap: Record<string, number> = {};
    const codeBatchSize = 100;
    const rowBatchSize = 1000;

    for (let i = 0; i < codes.length; i += codeBatchSize) {
      const batch = codes.slice(i, i + codeBatchSize);
      let rowFrom = 0;

      while (true) {
        const { data, error } = await supabase
          .from(shipmentsTable)
          .select('client_code, total_amount')
          .in('client_code', batch)
          .gte('ship_date', twelveStr)
          .range(rowFrom, rowFrom + rowBatchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const s of data) {
          if (!s.client_code) continue;
          salesMap[s.client_code] = (salesMap[s.client_code] || 0) + (s.total_amount || 0);
        }

        if (data.length < rowBatchSize) break;
        rowFrom += rowBatchSize;
      }
    }

    // 5. 활성 리스팅 수 계산 (listing_months 내 발주 있는 고유 품목 수)
    // 가장 긴 listing_months 값 사용
    let maxListingMonths = fallbackRule.listing_months || 6;
    for (const [, r] of ruleMap) {
      if (r.listing_months > maxListingMonths) maxListingMonths = r.listing_months;
    }
    const listingCutoff = new Date();
    listingCutoff.setMonth(listingCutoff.getMonth() - maxListingMonths);
    const listingCutoffStr = listingCutoff.toISOString().slice(0, 10);

    const listingMap: Record<string, Set<string>> = {};

    for (let i = 0; i < codes.length; i += codeBatchSize) {
      const batch = codes.slice(i, i + codeBatchSize);
      let rowFrom = 0;

      while (true) {
        const { data, error } = await supabase
          .from(shipmentsTable)
          .select('client_code, item_no')
          .in('client_code', batch)
          .gte('ship_date', listingCutoffStr)
          .range(rowFrom, rowFrom + rowBatchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const s of data) {
          if (!s.client_code || !s.item_no) continue;
          if (!listingMap[s.client_code]) listingMap[s.client_code] = new Set();
          listingMap[s.client_code].add(s.item_no);
        }

        if (data.length < rowBatchSize) break;
        rowFrom += rowBatchSize;
      }
    }

    // 6. 등급 판정 및 업데이트 — 매출 vs 리스팅 중 더 좋은 등급 적용
    let updated = 0;
    const results: {
      code: string;
      name?: string;
      sales: number;
      listings: number;
      oldGrade: number;
      newGrade: number;
      salesGrade: number;
      listingGrade: number;
      businessType: string;
    }[] = [];

    for (const code of codes) {
      const sales = salesMap[code] || 0;
      const listings = listingMap[code]?.size || 0;
      const biz = bizTypeMap[code] || '_all';

      // 업종별 규칙 매칭: 업종 정확 → _all 폴백
      const rule = ruleMap.get(biz) || fallbackRule;

      const salesGrade = gradeFromSales(sales, rule);
      const listingGrade = gradeFromListings(listings, rule);
      const newImportance = Math.min(salesGrade, listingGrade); // 더 좋은(낮은 숫자) 등급

      // 현재 등급 조회
      const { data: current } = await supabase
        .from('client_details')
        .select('importance, client_name')
        .eq('client_code', code)
        .single();

      const oldImportance = current?.importance || 3;

      if (oldImportance !== newImportance) {
        const { error } = await supabase
          .from('client_details')
          .update({ importance: newImportance, updated_at: new Date().toISOString() })
          .eq('client_code', code);

        if (!error) {
          updated++;
          results.push({
            code,
            name: current?.client_name,
            sales,
            listings,
            oldGrade: oldImportance,
            newGrade: newImportance,
            salesGrade,
            listingGrade,
            businessType: biz,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: codes.length,
      listingCutoff: listingCutoffStr,
      changes: results,
    });
  } catch (err) {
    console.error('POST /api/sales/grade-rules/apply error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
