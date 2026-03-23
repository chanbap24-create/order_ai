import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const BRAND_COUNTRY: Record<string, string> = {
  CH:'프랑스',LV:'프랑스',VA:'프랑스',ST:'스페인',MS:'이탈리아',WM:'프랑스',
  DE:'프랑스',HP:'미국',IC:'프랑스',DC:'프랑스',VC:'프랑스',DD:'프랑스',
  GH:'포르투갈',MM:'스페인',MR:'프랑스',MG:'프랑스',MB:'미국',CF:'프랑스',
  AD:'미국',TM:'미국',DF:'프랑스',OR:'이탈리아',CC:'프랑스',CO:'포르투갈',
  VG:'프랑스',LM:'프랑스',SM:'스페인',BL:'프랑스',RB:'프랑스',CK:'아르헨티나',
  SU:'프랑스',RO:'호주',LG:'프랑스',BR:'이탈리아',CD:'프랑스',CP:'프랑스',
  RG:'미국',BS:'이탈리아',AS:'이탈리아',AZ:'이탈리아',GT:'호주',FC:'이탈리아',
};

function inferType(name: string): string | null {
  const n = (name || '').toLowerCase();
  if (/로제|rosé|rosato/.test(n)) return '로제';
  if (/스파클링|브륏|brut|크레망|crémant|샴페인|champagne|프로세코|카바|cava/.test(n)) return '스파클링';
  if (/포트|포르트|마데이라|셰리|주정강화|토니|tawny/.test(n)) return '주정강화';
  if (/소비뇽 블랑|샤르도네|리슬링|비오니에|피노 그리|그뤼너|게뷔르츠|모스카토|블랑|비앙코|branco|blanc|white|알바리뇨|베르멘티노|토론테스|화이트/.test(n)) return '화이트';
  if (/카베르네|메를로|피노누아|피노 누아|시라|시라즈|템프라니요|산지오베제|네비올로|말벡|진판델|그르나슈|클라렛|레드|rosso|tinto|rouge|가메|바르베라|돌체토|아글리아니코|카르메네르/.test(n)) return '레드';
  return null;
}

// 와인 정보 매칭
function resolveWine(
  itemNo: string, itemName: string,
  wineMap: Map<string, any>, invMap: Map<string, string>, brandCountry: Map<string, string>,
): { country: string | null; region: string | null; wineType: string | null } {
  let country: string | null = null, region: string | null = null, wineType: string | null = null;

  const w = wineMap.get(itemNo);
  if (w) { country = w.country; region = w.region; wineType = w.wine_type; }
  if (!country) country = invMap.get(itemNo) || null;
  if (!country) {
    const base = itemNo.slice(0, 2) + itemNo.slice(4);
    for (const [k, v] of wineMap) {
      if (k.slice(0, 2) + k.slice(4) === base) { country = v.country; region = v.region; wineType = v.wine_type; break; }
    }
  }
  if (!country) {
    const m = (itemName || '').match(/^([A-Z]{2,3})\s/);
    if (m && brandCountry.has(m[1])) country = brandCountry.get(m[1])!;
  }
  if (!wineType) wineType = inferType(itemName || '');
  return { country, region, wineType };
}

// GET /api/marketing/sales-analysis?start_date=2024-01-01&end_date=2026-03-31&country=프랑스&region=Bourgogne&wine_type=레드
// 필터 없으면 전체 조회. 필터 있으면 해당 조건만.
// mode=options → 선택 가능한 국가/지역/타입 목록 반환
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const filterCountry = searchParams.get('country') || '';
    const filterRegion = searchParams.get('region') || '';
    const filterType = searchParams.get('wine_type') || '';

    // wines/inventory 로드
    const { data: wines } = await supabase.from('wines')
      .select('item_code, item_name_kr, country, region, wine_type')
      .not('item_code', 'like', 'D%');
    const wineMap = new Map<string, any>();
    for (const w of (wines || [])) wineMap.set(w.item_code, w);

    const { data: inv } = await supabase.from('inventory_cdv').select('item_no, country');
    const invMap = new Map<string, string>();
    for (const r of (inv || [])) if (r.country) invMap.set(r.item_no, r.country);

    const brandCountry = new Map<string, string>();
    for (const w of (wines || [])) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2})\s/);
      if (m && w.country) brandCountry.set(m[1], w.country);
    }
    for (const [k, v] of Object.entries(BRAND_COUNTRY)) {
      if (!brandCountry.has(k)) brandCountry.set(k, v);
    }

    // mode=options: 선택 가능한 필터 값 목록
    if (mode === 'options') {
      const countries = new Set<string>();
      const regionsByCountry: Record<string, Set<string>> = {};
      const types = new Set<string>();
      for (const w of (wines || [])) {
        if (w.country) { countries.add(w.country); }
        if (w.country && w.region) {
          if (!regionsByCountry[w.country]) regionsByCountry[w.country] = new Set();
          regionsByCountry[w.country].add(w.region);
        }
        if (w.wine_type) types.add(w.wine_type);
      }
      const regionsObj: Record<string, string[]> = {};
      for (const [c, s] of Object.entries(regionsByCountry)) regionsObj[c] = [...s].sort();
      return NextResponse.json({
        countries: [...countries].sort(),
        regions: regionsObj,
        types: [...types].sort(),
      });
    }

    // 기간 필수
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    // shipments 집계
    type ItemAgg = { item_no: string; item_name: string; qty: number; amount: number; country: string; region: string | null; wineType: string | null };
    const itemAgg: Record<string, ItemAgg> = {};
    const monthlyQty: Record<string, number> = {};
    let totalQty = 0, matchedCountry = 0, matchedRegion = 0, matchedType = 0;

    let offset = 0;
    const batch = 1000;
    while (true) {
      const { data, error } = await supabase.from('shipments')
        .select('item_no, item_name, quantity, selling_price, ship_date')
        .gte('ship_date', startDate).lte('ship_date', endDate)
        .range(offset, offset + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const r of data) {
        if (!r.item_no || r.item_no.length < 5 || r.item_no.startsWith('D') || r.item_no.startsWith('9F')) continue;
        if (/^7[0-9A-Z]/.test(r.item_no) && (r.item_name || '').includes('특판')) continue;
        const qty = r.quantity || 0;
        if (qty === 0) continue;

        const { country, region, wineType } = resolveWine(r.item_no, r.item_name || '', wineMap, invMap, brandCountry);

        // 필터 적용
        if (filterCountry && country !== filterCountry) continue;
        if (filterRegion && (!region || !region.toLowerCase().includes(filterRegion.toLowerCase()))) continue;
        if (filterType && wineType !== filterType) continue;

        const absQty = Math.abs(qty);
        const amount = Math.abs((r.selling_price || 0) * qty);
        totalQty += absQty;
        if (country) matchedCountry += absQty;
        if (region) matchedRegion += absQty;
        if (wineType) matchedType += absQty;

        const month = (r.ship_date || '').slice(0, 7);
        monthlyQty[month] = (monthlyQty[month] || 0) + absQty;

        const key = r.item_no;
        if (!itemAgg[key]) {
          itemAgg[key] = { item_no: r.item_no, item_name: r.item_name || '', qty: 0, amount: 0, country: country || '', region, wineType };
        }
        itemAgg[key].qty += absQty;
        itemAgg[key].amount += amount;
      }
      if (data.length < batch) break;
      offset += batch;
    }

    // 국가별 집계
    const countryAgg: Record<string, { qty: number; amount: number; items: number }> = {};
    const regionAgg: Record<string, Record<string, number>> = {};
    const typeAgg: Record<string, number> = {};

    for (const item of Object.values(itemAgg)) {
      if (item.country) {
        if (!countryAgg[item.country]) countryAgg[item.country] = { qty: 0, amount: 0, items: 0 };
        countryAgg[item.country].qty += item.qty;
        countryAgg[item.country].amount += item.amount;
        countryAgg[item.country].items += 1;
        if (item.region) {
          if (!regionAgg[item.country]) regionAgg[item.country] = {};
          regionAgg[item.country][item.region] = (regionAgg[item.country][item.region] || 0) + item.qty;
        }
      }
      if (item.wineType) {
        typeAgg[item.wineType] = (typeAgg[item.wineType] || 0) + item.qty;
      }
    }

    const countries = Object.entries(countryAgg)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.qty - a.qty);

    const regions: Record<string, { name: string; qty: number }[]> = {};
    for (const [c, regs] of Object.entries(regionAgg)) {
      regions[c] = Object.entries(regs).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
    }

    const types = Object.entries(typeAgg)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    // 품목별 TOP
    const topItems = Object.values(itemAgg).sort((a, b) => b.qty - a.qty).slice(0, 30)
      .map(({ item_no, item_name, qty, amount, country, region, wineType }) => ({ item_no, item_name, qty, amount, country, region, wine_type: wineType }));

    // 월별 추이
    const monthly = Object.entries(monthlyQty).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, qty]) => ({ month, qty }));

    return NextResponse.json({
      total_qty: totalQty,
      match_rate: {
        country: totalQty > 0 ? Math.round(matchedCountry / totalQty * 100) : 0,
        region: totalQty > 0 ? Math.round(matchedRegion / totalQty * 100) : 0,
        type: totalQty > 0 ? Math.round(matchedType / totalQty * 100) : 0,
      },
      countries,
      regions,
      types,
      top_items: topItems,
      monthly,
    });
  } catch (err) {
    console.error('GET /api/marketing/sales-analysis error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
