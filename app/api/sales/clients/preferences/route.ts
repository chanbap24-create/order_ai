import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { extractFlavorKeys } from '@/app/api/sales/recommend/lib/flavor';
import { findHierarchy, regionDisplayLabel, type WineRegionRow } from '@/app/api/sales/recommend/lib/regions';
import { fetchAll } from '@/app/api/sales/recommend/lib/fetchers';

// GET: 거래처 선호 분석 (가격대, 지역, 브랜드, 품종, 테이스트)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveStr = twelveMonthsAgo.toISOString().slice(0, 10);

    // 거래처 타입: 쿼리 파라미터 우선(와인·글라스 코드공간이 독립이라 코드만으로는 오인 가능)
    let clientType = searchParams.get('type') || '';
    if (clientType !== 'wine' && clientType !== 'glass') {
      const { data: detail } = await supabase
        .from('client_details')
        .select('client_type')
        .eq('client_code', code)
        .single();
      clientType = detail?.client_type === 'glass' ? 'glass' : 'wine';
    }
    const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';

    // 최근 1년 출고 데이터를 페이지네이션으로 전체 가져오기
    const allShipments: { item_no: string; item_name: string; quantity: number; total_amount: number; selling_price: number }[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('item_no, item_name, quantity, total_amount, selling_price')
        .eq('client_code', code)
        .gte('ship_date', twelveStr)
        .gt('quantity', 0)
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allShipments.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    if (allShipments.length === 0) {
      return NextResponse.json({ priceRanges: [], regions: [], brands: [], grapes: [], tastes: [] });
    }

    // 고유 품목 코드
    const itemCodes = [...new Set(allShipments.filter(s => s.item_no).map(s => s.item_no))];

    // ── wines·tasting_notes 매칭: 정확 품번 우선, 없으면 빈티지 무시(품번 3~4자리 제거) 폴백 ──
    // 품번 3~4자리 = 빈티지(extractVintage)라, 신빈티지로 재등록된 품목은 구빈티지 출고와
    // 품번이 어긋나 메타·테이스트가 통째로 누락되던 문제(정확 매칭 76%/34% → 88%/52%).
    const baseKey = (c: string) => (c && c.length >= 5 ? c.slice(0, 2) + c.slice(4) : c);

    type WineRow = { item_code: string; country: string; country_en: string; region: string; grape_varieties: string; wine_type: string; supply_price: number; item_name_kr: string; item_name_en: string; brand: string; supplier: string; supplier_kr: string };
    type NoteRow = { wine_id: string; nose_note: string; palate_note: string; flavor_tags: string[] | null };

    // 카탈로그가 작아(wines ~2천·notes ~수백) 전체 로드 후 JS 매칭이 배치 .in 보다 단순·확실
    const wineRows: WineRow[] = [];
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error } = await supabase
        .from('wines')
        .select('item_code, country, country_en, region, grape_varieties, wine_type, supply_price, item_name_kr, item_name_en, brand, supplier, supplier_kr')
        .range(off, off + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      wineRows.push(...(data as WineRow[]));
      if (data.length < 1000) break;
    }
    const noteRows: NoteRow[] = [];
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error } = await supabase
        .from('tasting_notes')
        .select('wine_id, nose_note, palate_note, flavor_tags')
        .range(off, off + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      noteRows.push(...(data as NoteRow[]));
      if (data.length < 1000) break;
    }

    const wineExact = new Map<string, WineRow>();
    const wineBase = new Map<string, WineRow>();
    for (const w of wineRows) {
      wineExact.set(w.item_code, w);
      wineBase.set(baseKey(w.item_code), w); // 동일 베이스는 나중 행(대개 최신 빈티지)으로 덮임
    }
    const noteExact = new Map<string, NoteRow>();
    const noteBase = new Map<string, NoteRow>();
    for (const n of noteRows) {
      if (!n.nose_note && !n.palate_note) continue;
      noteExact.set(n.wine_id, n);
      noteBase.set(baseKey(n.wine_id), n);
    }

    const wineMap = new Map<string, WineRow>();
    // 품목 → 58키 표준 향미태그. flavor_tags(조사 시 자동 태깅) 우선,
    // 태그 없는 구노트는 같은 추출기(extractFlavorKeys)로 텍스트에서 도출 — 단일 어휘 경로.
    const tasteMap = new Map<string, string[]>();
    for (const c of itemCodes) {
      const w = wineExact.get(c) || wineBase.get(baseKey(c));
      if (w) wineMap.set(c, w);
      const n = noteExact.get(c) || noteBase.get(baseKey(c));
      if (n) {
        const keys = n.flavor_tags && n.flavor_tags.length
          ? n.flavor_tags
          : [...extractFlavorKeys(`${n.nose_note || ''} ${n.palate_note || ''}`)];
        if (keys.length) tasteMap.set(c, keys);
      }
    }

    // 브랜드 = wines.brand 우선(2001/2008건 관리), 없으면 supplier_kr/supplier 폴백(988건뿐)
    const brandMap = new Map<string, string>();
    for (const [code, w] of wineMap) {
      const brand = w.brand || w.supplier_kr || w.supplier || '';
      if (brand) brandMap.set(code, brand);
    }

    // ── 집계 ──
    // 품목별 수량/금액 합산
    const itemAgg = new Map<string, { qty: number; amt: number; price: number }>();
    for (const s of allShipments) {
      if (!s.item_no) continue;
      const prev = itemAgg.get(s.item_no) || { qty: 0, amt: 0, price: 0 };
      prev.qty += s.quantity || 0;
      prev.amt += s.total_amount || 0;
      if (s.selling_price > 0) prev.price = s.selling_price;
      itemAgg.set(s.item_no, prev);
    }

    // 1. 가격대별 분포
    const priceRangeMap = new Map<string, { label: string; qty: number; amt: number; order: number }>();
    const priceRanges = [
      { min: 0, max: 20000, label: '~2만', order: 1 },
      { min: 20000, max: 50000, label: '2~5만', order: 2 },
      { min: 50000, max: 100000, label: '5~10만', order: 3 },
      { min: 100000, max: 200000, label: '10~20만', order: 4 },
      { min: 200000, max: 500000, label: '20~50만', order: 5 },
      { min: 500000, max: Infinity, label: '50만+', order: 6 },
    ];

    for (const [itemNo, agg] of itemAgg) {
      const wine = wineMap.get(itemNo);
      const price = wine?.supply_price || agg.price || 0;
      if (price <= 0) continue;
      const range = priceRanges.find(r => price >= r.min && price < r.max) || priceRanges[priceRanges.length - 1];
      const prev = priceRangeMap.get(range.label) || { label: range.label, qty: 0, amt: 0, order: range.order };
      prev.qty += agg.qty;
      prev.amt += agg.amt;
      priceRangeMap.set(range.label, prev);
    }

    // 2. 지역별 분포 — 추천 근거(거래처 분석)와 동일한 산지 계층(wine_regions) 라벨로 통일:
    //    광역(super) → 대지역(major) → 국가 순. 원문(wines.region) 표기 편차(Bourgogne/Burgundy 등) 제거.
    const regionRows = await fetchAll<WineRegionRow>(
      'wine_regions', 'country, sub_region, major_region, appellation, cru_vineyard, classification');
    const regionMap = new Map<string, { qty: number; amt: number }>();
    for (const [itemNo, agg] of itemAgg) {
      const wine = wineMap.get(itemNo);
      const h = wine ? findHierarchy(
        wine.region || '', `${wine.item_name_kr || ''} ${wine.item_name_en || ''}`,
        regionRows, wine.country_en || wine.country || '') : null;
      const raw = h?.super_region || h?.major_region || wine?.country || '기타';
      const region = regionDisplayLabel(raw) || '기타';
      if (!region) continue;
      const prev = regionMap.get(region) || { qty: 0, amt: 0 };
      prev.qty += agg.qty;
      prev.amt += agg.amt;
      regionMap.set(region, prev);
    }

    // 3. 브랜드별 분포
    const brandAggMap = new Map<string, { qty: number; amt: number }>();
    for (const [itemNo, agg] of itemAgg) {
      const brand = brandMap.get(itemNo) || '기타';
      const prev = brandAggMap.get(brand) || { qty: 0, amt: 0 };
      prev.qty += agg.qty;
      prev.amt += agg.amt;
      brandAggMap.set(brand, prev);
    }

    // 4. 품종별 분포
    const grapeMap = new Map<string, { qty: number; amt: number }>();
    for (const [itemNo, agg] of itemAgg) {
      const wine = wineMap.get(itemNo);
      const grapes = wine?.grape_varieties;
      if (!grapes) continue;
      // 복수 품종 분할
      const varieties = grapes.split(/[,/&]/).map(g => g.trim()).filter(Boolean);
      for (const grape of varieties) {
        const prev = grapeMap.get(grape) || { qty: 0, amt: 0 };
        prev.qty += agg.qty;
        prev.amt += agg.amt;
        grapeMap.set(grape, prev);
      }
    }

    // 5. 테이스트 프로필 — 58키 표준 향미태그를 화면용 대분류로 집계
    const tasteKeywords = new Map<string, { count: number; totalQty: number }>();
    // 58키 → 대분류 (구조감 키(tannic/full_body/light_body)는 향미가 아니라 제외)
    const KEY_CATEGORY: Record<string, string> = {
      lemon: '과일향', lime: '과일향', grapefruit: '과일향', green_apple: '과일향', apple: '과일향',
      pear: '과일향', quince: '과일향', peach: '과일향', apricot: '과일향', pineapple: '과일향',
      mango: '과일향', passionfruit: '과일향', lychee: '과일향', melon: '과일향', cherry: '과일향',
      strawberry: '과일향', raspberry: '과일향', redcurrant: '과일향', blackberry: '과일향',
      blackcurrant: '과일향', plum: '과일향', blueberry: '과일향', dried_fruit: '과일향',
      violet: '꽃향', rose: '꽃향', floral_white: '꽃향', elderflower: '꽃향',
      mint: '허브', eucalyptus: '허브', herb_green: '허브', green_pepper: '허브', grassy: '허브',
      black_pepper: '스파이스', sweet_spice: '스파이스', licorice: '스파이스',
      vanilla: '오크/바닐라', toast: '오크/바닐라', cedar: '오크/바닐라', coconut: '오크/바닐라',
      coffee_choc: '초콜릿/커피',
      mushroom: '흙/가죽', forest_floor: '흙/가죽', leather_tobacco: '흙/가죽', game_meat: '흙/가죽', tar: '흙/가죽',
      flint: '미네랄', wet_stone: '미네랄', chalk: '미네랄', saline: '미네랄', petrol: '미네랄',
      butter: '크림/효모', cream: '크림/효모', brioche_yeast: '크림/효모',
      nutty: '견과류', honey: '꿀/달콤',
    };

    for (const [itemNo, agg] of itemAgg) {
      const keys = tasteMap.get(itemNo);
      if (!keys) continue;
      const categories = new Set<string>();
      for (const k of keys) {
        const cat = KEY_CATEGORY[k];
        if (cat) categories.add(cat);
      }
      for (const category of categories) {
        const prev = tasteKeywords.get(category) || { count: 0, totalQty: 0 };
        prev.count += 1; // 품목 수
        prev.totalQty += agg.qty;
        tasteKeywords.set(category, prev);
      }
    }

    // 결과 정렬
    const priceResult = Array.from(priceRangeMap.values()).sort((a, b) => a.order - b.order);
    const regionResult = Array.from(regionMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 8);
    const brandResult = Array.from(brandAggMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 8);
    const grapeResult = Array.from(grapeMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 8);
    const tasteResult = Array.from(tasteKeywords.entries())
      .map(([name, v]) => ({ name, count: v.count, qty: v.totalQty }))
      .sort((a, b) => b.qty - a.qty);

    return NextResponse.json({
      priceRanges: priceResult,
      regions: regionResult,
      brands: brandResult,
      grapes: grapeResult,
      tastes: tasteResult,
    });
  } catch (err) {
    console.error('GET /api/sales/clients/preferences error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
