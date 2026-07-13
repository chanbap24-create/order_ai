import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

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

    type WineRow = { item_code: string; country: string; region: string; grape_varieties: string; wine_type: string; supply_price: number; item_name_kr: string; brand: string; supplier: string; supplier_kr: string };
    type NoteRow = { wine_id: string; nose_note: string; palate_note: string };

    // 카탈로그가 작아(wines ~2천·notes ~수백) 전체 로드 후 JS 매칭이 배치 .in 보다 단순·확실
    const wineRows: WineRow[] = [];
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error } = await supabase
        .from('wines')
        .select('item_code, country, region, grape_varieties, wine_type, supply_price, item_name_kr, brand, supplier, supplier_kr')
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
        .select('wine_id, nose_note, palate_note')
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
    const tasteMap = new Map<string, { nose_note: string; palate_note: string }>();
    for (const c of itemCodes) {
      const w = wineExact.get(c) || wineBase.get(baseKey(c));
      if (w) wineMap.set(c, w);
      const n = noteExact.get(c) || noteBase.get(baseKey(c));
      if (n) tasteMap.set(c, { nose_note: n.nose_note || '', palate_note: n.palate_note || '' });
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

    // 2. 지역별 분포 (동일 지역 영/불 표기 통일)
    const REGION_ALIAS: Record<string, string> = { Burgundy: 'Bourgogne' };
    const regionMap = new Map<string, { qty: number; amt: number }>();
    for (const [itemNo, agg] of itemAgg) {
      const wine = wineMap.get(itemNo);
      const raw = wine?.region?.split(',')[0]?.trim() || wine?.country || '기타';
      const region = REGION_ALIAS[raw] || raw;
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

    // 5. 테이스트 키워드 분석
    const tasteKeywords = new Map<string, { count: number; totalQty: number }>();
    // 향미 키워드 사전
    const TASTE_CATEGORIES: Record<string, string[]> = {
      '과일향': ['사과', '배', '체리', '라즈베리', '딸기', '블랙베리', '자두', '카시스', '복숭아', '살구', '감귤', '레몬', '오렌지', '자몽', '열대과일', '망고', '파인애플', '리치', '블루베리', '과실'],
      '꽃향': ['장미', '제비꽃', '바이올렛', '아카시아', '자스민', '꽃', '플로럴', '라벤더', '흰꽃'],
      '오크/바닐라': ['바닐라', '오크', '토스트', '캐러멜', '버터', '삼나무', '시더', '코코넛'],
      '스파이스': ['후추', '정향', '시나몬', '계피', '향신료', '스파이스', '넛맥', '감초', '생강'],
      '미네랄': ['미네랄', '석회', '화강암', '부싯돌', '짠맛', '소금'],
      '견과류': ['아몬드', '헤이즐넛', '견과', '호두', '땅콩'],
      '허브': ['허브', '타임', '로즈마리', '민트', '유칼립투스', '세이지'],
      '초콜릿/커피': ['초콜릿', '코코아', '커피', '에스프레소', '모카', '다크 초콜릿'],
      '흙/가죽': ['흙', '가죽', '버섯', '트러플', '담배', '숲'],
      '꿀/달콤': ['꿀', '잼', '설탕', '캔디', '달콤'],
    };

    for (const [itemNo, agg] of itemAgg) {
      const taste = tasteMap.get(itemNo);
      if (!taste) continue;
      const text = `${taste.nose_note} ${taste.palate_note}`;
      for (const [category, keywords] of Object.entries(TASTE_CATEGORIES)) {
        let found = false;
        for (const kw of keywords) {
          if (text.includes(kw)) { found = true; break; }
        }
        if (found) {
          const prev = tasteKeywords.get(category) || { count: 0, totalQty: 0 };
          prev.count += 1; // 품목 수
          prev.totalQty += agg.qty;
          tasteKeywords.set(category, prev);
        }
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
