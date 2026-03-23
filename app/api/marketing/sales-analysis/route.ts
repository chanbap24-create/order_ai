import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 브랜드약어 → 국가 수동 매핑
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const years = parseInt(searchParams.get('years') || '2');
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const startDate = `${now.getUTCFullYear() - years}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

    // 1. wines 테이블 로드
    const { data: wines } = await supabase
      .from('wines')
      .select('item_code, item_name_kr, country, region, wine_type')
      .not('item_code', 'like', 'D%');
    const wineMap = new Map<string, typeof wines extends (infer T)[] | null ? T : never>();
    for (const w of (wines || [])) wineMap.set(w.item_code, w);

    // 2. inventory_cdv
    const { data: inv } = await supabase.from('inventory_cdv').select('item_no, country');
    const invMap = new Map<string, string>();
    for (const r of (inv || [])) if (r.country) invMap.set(r.item_no, r.country);

    // 3. 브랜드약어 매핑 (wines + 수동)
    const brandCountry = new Map<string, string>();
    for (const w of (wines || [])) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2})\s/);
      if (m && w.country) brandCountry.set(m[1], w.country);
    }
    for (const [k, v] of Object.entries(BRAND_COUNTRY)) {
      if (!brandCountry.has(k)) brandCountry.set(k, v);
    }

    // 4. shipments 집계
    type MonthData = { qty: number; amount: number };
    const countryData: Record<string, { qty: number; amount: number; months: Record<string, MonthData> }> = {};
    const regionData: Record<string, Record<string, { qty: number }>> = {};
    const typeData: Record<string, { qty: number; months: Record<string, MonthData> }> = {};
    let totalQty = 0;
    let matchedCountry = 0, matchedRegion = 0, matchedType = 0;

    const batch = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('shipments')
        .select('item_no, item_name, quantity, selling_price, ship_date')
        .gte('ship_date', startDate)
        .range(offset, offset + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const r of data) {
        if (!r.item_no || r.item_no.length < 5 || r.item_no.startsWith('D') || r.item_no.startsWith('9F')) continue;
        if (/^7[0-9A-Z]/.test(r.item_no) && (r.item_name || '').includes('특판')) continue;
        const qty = r.quantity || 0;
        if (qty === 0) continue;
        const absQty = Math.abs(qty);
        const amount = Math.abs((r.selling_price || 0) * qty);
        const month = (r.ship_date || '').slice(0, 7);
        totalQty += absQty;

        // 매칭
        let country: string | null = null;
        let region: string | null = null;
        let wineType: string | null = null;

        const w = wineMap.get(r.item_no);
        if (w) { country = w.country; region = w.region; wineType = w.wine_type; }
        if (!country) { country = invMap.get(r.item_no) || null; }
        if (!country) {
          const base = r.item_no.slice(0, 2) + r.item_no.slice(4);
          for (const [k, v] of wineMap) {
            if (k.slice(0, 2) + k.slice(4) === base) {
              country = v.country; region = v.region; wineType = v.wine_type; break;
            }
          }
        }
        if (!country) {
          const m = (r.item_name || '').match(/^([A-Z]{2,3})\s/);
          if (m && brandCountry.has(m[1])) country = brandCountry.get(m[1])!;
        }
        if (!wineType) wineType = inferType(r.item_name || '');

        if (country) {
          matchedCountry += absQty;
          if (!countryData[country]) countryData[country] = { qty: 0, amount: 0, months: {} };
          countryData[country].qty += absQty;
          countryData[country].amount += amount;
          if (!countryData[country].months[month]) countryData[country].months[month] = { qty: 0, amount: 0 };
          countryData[country].months[month].qty += absQty;
          countryData[country].months[month].amount += amount;

          if (region) {
            matchedRegion += absQty;
            if (!regionData[country]) regionData[country] = {};
            if (!regionData[country][region]) regionData[country][region] = { qty: 0 };
            regionData[country][region].qty += absQty;
          }
        }

        if (wineType) {
          matchedType += absQty;
          if (!typeData[wineType]) typeData[wineType] = { qty: 0, months: {} };
          typeData[wineType].qty += absQty;
          if (!typeData[wineType].months[month]) typeData[wineType].months[month] = { qty: 0, amount: 0 };
          typeData[wineType].months[month].qty += absQty;
          typeData[wineType].months[month].amount += amount;
        }
      }
      if (data.length < batch) break;
      offset += batch;
    }

    // 정렬
    const countries = Object.entries(countryData)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.qty - a.qty);

    const regions: Record<string, { name: string; qty: number }[]> = {};
    for (const [country, regs] of Object.entries(regionData)) {
      regions[country] = Object.entries(regs)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.qty - a.qty);
    }

    const types = Object.entries(typeData)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.qty - a.qty);

    return NextResponse.json({
      period: { start: startDate, years },
      total_qty: totalQty,
      match_rate: {
        country: totalQty > 0 ? Math.round(matchedCountry / totalQty * 100) : 0,
        region: totalQty > 0 ? Math.round(matchedRegion / totalQty * 100) : 0,
        type: totalQty > 0 ? Math.round(matchedType / totalQty * 100) : 0,
      },
      countries,
      regions,
      types,
    });
  } catch (err) {
    console.error('GET /api/marketing/sales-analysis error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
