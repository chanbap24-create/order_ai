import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const DEFAULT_STOCK_RULES = {
  price_300k: 6,
  price_200k: 12,
  price_100k: 60,
  price_50k: 120,
  price_20k: 180,
  price_under_20k: 300,
};

async function loadStockRules() {
  const { data } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle();
  return data ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(data.value) } : { ...DEFAULT_STOCK_RULES };
}

function minStockForPrice(price: number, SR: typeof DEFAULT_STOCK_RULES): number {
  if (price >= 300000) return SR.price_300k;
  if (price >= 200000) return SR.price_200k;
  if (price >= 100000) return SR.price_100k;
  if (price >= 50000) return SR.price_50k;
  if (price >= 20000) return SR.price_20k;
  return SR.price_under_20k;
}

function normalizeGrapes(raw: string): string[] {
  if (!raw) return [];
  return raw.toLowerCase().split(/[,\/]/).map(g => g.trim()).filter(Boolean);
}

function typesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al === bl || al.includes(bl) || bl.includes(al);
}

function grapesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return a.some(ag => b.some(bg => ag.includes(bg) || bg.includes(ag)));
}

function priceInRange(target: number, candidate: number, pct: number): boolean {
  if (target <= 0 || candidate <= 0) return false;
  const diff = Math.abs(candidate - target) / target;
  return diff <= pct;
}

// ── GET: 지역 우선 확장 방식 대체 와인 추천 ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemNo = searchParams.get('item_no');
    if (!itemNo) {
      return NextResponse.json({ error: 'item_no 파라미터가 필요합니다.' }, { status: 400 });
    }

    const SR = await loadStockRules();

    // 1. 대상 와인 속성 조회
    const { data: targetWine } = await supabase
      .from('wines')
      .select('item_code, item_name_kr, grape_varieties, wine_type, country_en, region, supply_price')
      .eq('item_code', itemNo)
      .maybeSingle();

    const { data: targetInv } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, country, supply_price')
      .eq('item_no', itemNo)
      .maybeSingle();

    const targetName = targetWine?.item_name_kr || targetInv?.item_name || itemNo;
    const targetGrapes = normalizeGrapes(targetWine?.grape_varieties || '');
    const targetType = (targetWine?.wine_type || '').toLowerCase();
    const targetCountry = (targetWine?.country_en || targetInv?.country || '').toLowerCase();
    const targetRegion = (targetWine?.region || '').toLowerCase();
    const targetPrice = targetWine?.supply_price || targetInv?.supply_price || 0;

    // 2. 재고 충분한 후보 로드
    const { data: inventory } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, country, supply_price, available_stock, bonded_warehouse');

    const { data: wines } = await supabase
      .from('wines')
      .select('item_code, item_name_kr, grape_varieties, wine_type, country_en, region, supply_price');

    const wineMap = new Map<string, any>();
    for (const w of wines || []) wineMap.set(w.item_code, w);

    // 후보 목록 (재고 충분 + 자기 자신 제외)
    interface Candidate {
      item_no: string;
      item_name: string;
      country: string;
      region: string;
      grape: string;
      wine_type: string;
      price: number;
      stock: number;
    }

    const candidates: Candidate[] = [];
    for (const inv of inventory || []) {
      if (inv.item_no === itemNo) continue;
      const totalStock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0);
      if (totalStock <= 0) continue;
      const price = inv.supply_price || 0;
      if (totalStock < minStockForPrice(price, SR)) continue;

      const wine = wineMap.get(inv.item_no);
      candidates.push({
        item_no: inv.item_no,
        item_name: wine?.item_name_kr || inv.item_name || '',
        country: (wine?.country_en || inv.country || '').toLowerCase(),
        region: (wine?.region || '').toLowerCase(),
        grape: wine?.grape_varieties || '',
        wine_type: (wine?.wine_type || '').toLowerCase(),
        price,
        stock: totalStock,
      });
    }

    // 3. 지역 우선 확장 탐색
    interface Alternative {
      item_no: string;
      item_name: string;
      country: string;
      region: string;
      grape: string;
      wine_type: string;
      price: number;
      stock: number;
      match_level: number;
      match_label: string;
      match_reasons: string[];
    }

    const results: Alternative[] = [];
    const usedItemNos = new Set<string>();

    // Level 1: 같은 지역 + 같은 타입 + 가격 ±30% + 같은 품종
    if (targetRegion && targetType) {
      for (const c of candidates) {
        if (usedItemNos.has(c.item_no)) continue;
        const regionMatch = c.region && (c.region === targetRegion || c.region.includes(targetRegion) || targetRegion.includes(c.region));
        if (!regionMatch) continue;
        if (!typesMatch(targetType, c.wine_type)) continue;
        if (!priceInRange(targetPrice, c.price, 0.3)) continue;
        if (!grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) continue;

        usedItemNos.add(c.item_no);
        results.push({
          ...c,
          match_level: 1,
          match_label: '같은 지역 · 같은 품종',
          match_reasons: ['같은 지역', '같은 타입', '비슷한 가격', '같은 품종'],
        });
      }
    }

    // Level 2: 같은 지역 + 같은 타입 + 가격 ±30% (품종 무관)
    if (targetRegion && targetType) {
      for (const c of candidates) {
        if (usedItemNos.has(c.item_no)) continue;
        const regionMatch = c.region && (c.region === targetRegion || c.region.includes(targetRegion) || targetRegion.includes(c.region));
        if (!regionMatch) continue;
        if (!typesMatch(targetType, c.wine_type)) continue;
        if (!priceInRange(targetPrice, c.price, 0.3)) continue;

        usedItemNos.add(c.item_no);
        const reasons = ['같은 지역', '같은 타입', '비슷한 가격'];
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        results.push({
          ...c,
          match_level: 2,
          match_label: '같은 지역 · 같은 타입',
          match_reasons: reasons,
        });
      }
    }

    // Level 3: 같은 국가 + 같은 타입 + 가격 ±30%
    if (targetCountry && targetType && results.length < 10) {
      for (const c of candidates) {
        if (usedItemNos.has(c.item_no)) continue;
        if (c.country !== targetCountry) continue;
        if (!typesMatch(targetType, c.wine_type)) continue;
        if (!priceInRange(targetPrice, c.price, 0.3)) continue;

        usedItemNos.add(c.item_no);
        const reasons = ['같은 국가', '같은 타입', '비슷한 가격'];
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        results.push({
          ...c,
          match_level: 3,
          match_label: '같은 국가 · 같은 타입',
          match_reasons: reasons,
        });
      }
    }

    // Level 4: 같은 국가 + 같은 타입 + 가격 ±50%
    if (targetCountry && targetType && results.length < 10) {
      for (const c of candidates) {
        if (usedItemNos.has(c.item_no)) continue;
        if (c.country !== targetCountry) continue;
        if (!typesMatch(targetType, c.wine_type)) continue;
        if (!priceInRange(targetPrice, c.price, 0.5)) continue;

        usedItemNos.add(c.item_no);
        const reasons = ['같은 국가', '같은 타입', '유사 가격대'];
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        results.push({
          ...c,
          match_level: 4,
          match_label: '같은 국가 · 유사 가격',
          match_reasons: reasons,
        });
      }
    }

    // Level 5: 같은 타입 + 같은 품종 + 가격 ±30% (국가 무관)
    if (targetType && results.length < 10) {
      for (const c of candidates) {
        if (usedItemNos.has(c.item_no)) continue;
        if (!typesMatch(targetType, c.wine_type)) continue;
        if (!grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) continue;
        if (!priceInRange(targetPrice, c.price, 0.3)) continue;

        usedItemNos.add(c.item_no);
        const reasons = ['같은 타입', '같은 품종', '비슷한 가격'];
        if (c.country === targetCountry) reasons.push('같은 국가');
        results.push({
          ...c,
          match_level: 5,
          match_label: '같은 품종 · 비슷한 가격',
          match_reasons: reasons,
        });
      }
    }

    // Level 6: 같은 타입 + 가격 ±50% (가장 넓은 범위)
    if (targetType && results.length < 10) {
      for (const c of candidates) {
        if (usedItemNos.has(c.item_no)) continue;
        if (!typesMatch(targetType, c.wine_type)) continue;
        if (!priceInRange(targetPrice, c.price, 0.5)) continue;

        usedItemNos.add(c.item_no);
        const reasons = ['같은 타입', '유사 가격대'];
        if (c.country === targetCountry) reasons.push('같은 국가');
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        results.push({
          ...c,
          match_level: 6,
          match_label: '같은 타입 · 유사 가격',
          match_reasons: reasons,
        });
      }
    }

    // match_level 순 정렬 후 Top 10
    results.sort((a, b) => a.match_level - b.match_level);
    const top10 = results.slice(0, 10);

    return NextResponse.json({
      target: {
        item_no: itemNo,
        item_name: targetName,
        grape: targetWine?.grape_varieties || '',
        wine_type: targetWine?.wine_type || '',
        country: targetWine?.country_en || targetInv?.country || '',
        region: targetWine?.region || '',
        price: targetPrice,
      },
      alternatives: top10,
    });

  } catch (error) {
    console.error('Alternatives GET error:', error);
    return NextResponse.json(
      { error: '대체 와인 추천 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
