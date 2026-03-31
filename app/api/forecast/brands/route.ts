import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 브랜드(supplier_kr) 기준 소진 분석
export async function GET(req: NextRequest) {
  try {
    const startYear = req.nextUrl.searchParams.get('startYear') || '2022';
    const endYear = req.nextUrl.searchParams.get('endYear') || String(new Date().getFullYear());
    const startDate = `${startYear}-01-01`;
    const endDate = `${endYear}-12-31`;

    // 1. wines에서 brand(supplier_kr) 매핑
    const { data: wines } = await supabase.from('wines')
      .select('item_code, item_name_kr, supplier_kr, country, supply_price, wine_type')
      .not('item_code', 'like', 'D%');

    const itemBrand: Record<string, { brand: string; country: string; price: number }> = {};
    for (const w of (wines || [])) {
      const brand = w.supplier_kr || w.item_name_kr?.match(/^([A-Z]{2})\s/)?.[1] || '';
      if (brand) {
        itemBrand[w.item_code] = { brand, country: w.country || '', price: w.supply_price || 0 };
      }
    }

    // 2. shipments 조회 (기간 내)
    type Ship = { item_no: string; quantity: number; ship_date: string };
    const allShips: Ship[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.from('shipments')
        .select('item_no, quantity, ship_date')
        .gte('ship_date', startDate).lte('ship_date', endDate)
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allShips.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 3. 빈티지 매칭 캐시
    const vintageMap = new Map<string, string>(); // item_no → brand
    const vintageBase = new Map<string, { brand: string; country: string; price: number }>();
    for (const [code, info] of Object.entries(itemBrand)) {
      const base = code.slice(0, 2) + code.slice(4);
      const abbr = ((wines || []).find(w => w.item_code === code)?.item_name_kr || '').match(/^([A-Z]{2})\s/)?.[1] || '';
      if (!vintageBase.has(base + '|' + abbr)) {
        vintageBase.set(base + '|' + abbr, info);
      }
    }

    function resolveBrand(itemNo: string, itemName?: string): { brand: string; country: string; price: number } | null {
      // 직접 매칭
      if (itemBrand[itemNo]) return itemBrand[itemNo];
      // 빈티지 매칭
      const base = itemNo.slice(0, 2) + itemNo.slice(4);
      const abbr = (itemName || '').match(/^([A-Z]{2})\s/)?.[1] || '';
      const key = base + '|' + abbr;
      if (vintageBase.has(key)) return vintageBase.get(key)!;
      // abbr 없이 base만
      for (const [k, v] of vintageBase) {
        if (k.startsWith(base + '|')) return v;
      }
      return null;
    }

    // 4. 브랜드별 집계
    type BrandAgg = {
      brand: string; country: string; items: Set<string>; total: number;
      months: Record<string, number>; priceSum: number; priceQty: number;
    };
    const brandAgg: Record<string, BrandAgg> = {};

    for (const s of allShips) {
      if (!s.item_no || s.item_no.length < 5) continue;
      const firstChar = s.item_no.charAt(0).toUpperCase();
      if (!'0123456AZ'.includes(firstChar)) continue;
      const qty = s.quantity || 0;
      if (qty <= 0) continue;

      const info = resolveBrand(s.item_no);
      if (!info || !info.brand) continue;

      const key = info.brand;
      if (!brandAgg[key]) {
        brandAgg[key] = { brand: info.brand, country: info.country, items: new Set(), total: 0, months: {}, priceSum: 0, priceQty: 0 };
      }
      const b = brandAgg[key];
      b.items.add(s.item_no);
      b.total += qty;
      const ym = s.ship_date?.slice(0, 7);
      if (ym) b.months[ym] = (b.months[ym] || 0) + qty;
      if (info.price > 0) { b.priceSum += info.price * qty; b.priceQty += qty; }
    }

    // 5. 분석 결과 생성
    const brands = Object.values(brandAgg)
      .filter(b => b.total >= 12) // 최소 12병 이상
      .map(b => {
        const monthKeys = Object.keys(b.months).sort();
        const spanMonths = monthKeys.length;
        const monthlyAvg = spanMonths > 0 ? Math.round(b.total / spanMonths) : 0;
        const avgPrice = b.priceQty > 0 ? Math.round(b.priceSum / b.priceQty) : 0;

        // 소진 속도 (N케이스 소진 예상 개월)
        const months5c = monthlyAvg > 0 ? Math.round(60 / monthlyAvg) : 999;
        const months10c = monthlyAvg > 0 ? Math.round(120 / monthlyAvg) : 999;
        const months20c = monthlyAvg > 0 ? Math.round(240 / monthlyAvg) : 999;

        // 판매 패턴: 전반/후반 비교
        const half = Math.ceil(spanMonths / 2);
        const firstHalf = monthKeys.slice(0, half).reduce((s, m) => s + (b.months[m] || 0), 0);
        const secondHalf = monthKeys.slice(half).reduce((s, m) => s + (b.months[m] || 0), 0);
        const ratio = firstHalf > 0 ? secondHalf / firstHalf : 1;
        const pattern = ratio > 1.3 ? '후반가속' : ratio < 0.7 ? '초반집중' : '꾸준';

        // 최근 1/3/6/12개월 판매
        const now = new Date();
        const getRecentQty = (months: number) => {
          const cutoff = new Date(now);
          cutoff.setMonth(cutoff.getMonth() - months);
          const cutoffYm = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
          return monthKeys.filter(m => m >= cutoffYm).reduce((s, m) => s + (b.months[m] || 0), 0);
        };

        return {
          brand: b.brand,
          country: b.country,
          items: b.items.size,
          total: b.total,
          monthlyAvg,
          spanMonths,
          avgPrice,
          m1: getRecentQty(1),
          m3: getRecentQty(3),
          m6: getRecentQty(6),
          m12: getRecentQty(12),
          pattern,
          months5c,
          months10c,
          months20c,
        };
      })
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ brands });
  } catch (err) {
    console.error('GET /api/forecast/brands error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
