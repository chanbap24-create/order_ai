import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';

// GET ?client_code= : 거래처가 최근 1년 산 품목 목록(대체상품 모드의 '쇼트난 기준 상품' 선택용).
// 추천 엔진(buildCandidates)이 CDV(shipments) 기준이라 여기서도 shipments + wines 만 사용.
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('client_code');
    if (!code || !isValidClientCode(code)) {
      return NextResponse.json({ error: 'client_code가 필요합니다.' }, { status: 400 });
    }
    const access = await requireClientAccess(code);
    if (access) return access;

    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: ships } = await supabase
      .from('shipments')
      .select('item_no, item_name, unit_price, ship_date')
      .eq('client_code', code)
      .gte('ship_date', sinceStr)
      .gt('quantity', 0);

    const agg = new Map<string, { name: string; price: number; count: number; last: string }>();
    for (const s of (ships || []) as Array<{ item_no?: string; item_name?: string; unit_price?: number; ship_date?: string }>) {
      if (!s.item_no) continue;
      const p = agg.get(s.item_no) || { name: s.item_name || '', price: 0, count: 0, last: '' };
      p.count += 1;
      if (s.unit_price) p.price = s.unit_price;
      if (s.ship_date && s.ship_date > p.last) p.last = s.ship_date;
      agg.set(s.item_no, p);
    }

    const codes = [...agg.keys()];
    const wineMap = new Map<string, { item_name_kr?: string; region?: string; wine_type?: string; supply_price?: number }>();
    for (let i = 0; i < codes.length; i += 200) {
      const { data } = await supabase
        .from('wines')
        .select('item_code, item_name_kr, region, wine_type, supply_price')
        .in('item_code', codes.slice(i, i + 200));
      for (const w of data || []) wineMap.set(w.item_code, w);
    }

    const items = codes
      .map((c) => {
        const a = agg.get(c)!;
        const w = wineMap.get(c);
        return {
          item_code: c,
          name: w?.item_name_kr || a.name || c,
          price: w?.supply_price || a.price || 0,
          region: w?.region || '',
          wine_type: w?.wine_type || '',
          count: a.count,
          last: a.last,
        };
      })
      .sort((x, y) => y.last.localeCompare(x.last) || y.count - x.count)
      .slice(0, 60);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Recommend purchases error:', error);
    return NextResponse.json({ error: '구매이력 조회 실패' }, { status: 500 });
  }
}
