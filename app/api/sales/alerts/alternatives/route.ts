import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidItemNo } from '@/app/lib/validators';

import { fetchAll, fetchInventoryInStock, fetchWinesByCodes } from './lib/fetchers';
import { loadStockRules, minStockForPrice } from './lib/stockRules';
import { normalizeGrapes, normalizeType } from './lib/wineAttrs';
import { findHierarchy, type WineRegionRow } from './lib/regions';
import type { Candidate } from './lib/types';
import { findAlternatives } from './lib/levelSearch';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemNo = searchParams.get('item_no');
    if (!itemNo) {
      return NextResponse.json({ error: 'item_no 파라미터가 필요합니다.' }, { status: 400 });
    }
    if (!isValidItemNo(itemNo)) {
      return NextResponse.json({ error: 'Invalid item_no format' }, { status: 400 });
    }

    // Phase 1: 대상 와인/재고 + 설정 + 산지 + 재고 병렬 로드
    const [SR, targetWineRes, targetInvRes, inventory, regionRows] = await Promise.all([
      loadStockRules(),
      supabase.from('wines')
        .select('item_code, item_name_kr, item_name_en, grape_varieties, wine_type, country_en, region, supply_price')
        .eq('item_code', itemNo).maybeSingle(),
      supabase.from('inventory_cdv')
        .select('item_no, item_name, country, supply_price')
        .eq('item_no', itemNo).maybeSingle(),
      fetchInventoryInStock<Record<string, unknown>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse'),
      fetchAll<WineRegionRow>('wine_regions', 'sub_region, major_region, appellation, cru_vineyard, classification'),
    ]);
    const targetWine = targetWineRes.data;
    const targetInv = targetInvRes.data;

    // Phase 2: 재고 내 wines 만 .in()으로 조회
    const inventoryItemCodes = inventory
      .map((i) => (i as { item_no?: string }).item_no)
      .filter(Boolean) as string[];
    const wines = await fetchWinesByCodes<Record<string, unknown>>(
      inventoryItemCodes,
      'item_code, item_name_kr, item_name_en, grape_varieties, wine_type, country_en, region, supply_price',
    );

    const targetName = targetWine?.item_name_kr || targetInv?.item_name || itemNo;
    const targetFullName = `${targetWine?.item_name_kr || ''} ${targetWine?.item_name_en || ''}`;
    const targetGrapes = normalizeGrapes(targetWine?.grape_varieties || '');
    const targetType = normalizeType(targetWine?.wine_type || null, targetFullName || targetInv?.item_name || '');
    const targetCountry = (targetWine?.country_en || targetInv?.country || '').toLowerCase();
    const targetRegion = targetWine?.region || '';

    // 가격: supply_price가 0이면 같은 이름 와인에서 fallback
    let targetPrice = targetWine?.supply_price || targetInv?.supply_price || 0;
    if (targetPrice <= 0 && targetWine?.item_name_kr) {
      const nameBase = targetWine.item_name_kr.replace(/\s+/g, ' ').trim();
      const { data: sameName } = await supabase
        .from('wines')
        .select('supply_price')
        .ilike('item_name_kr', `%${nameBase}%`)
        .gt('supply_price', 0)
        .order('supply_price', { ascending: true })
        .limit(1);
      if (sameName?.[0]?.supply_price) targetPrice = sameName[0].supply_price;
    }

    // 타겟 계층 위치
    const allRegionRows = regionRows as WineRegionRow[];
    const targetHierarchy = findHierarchy(targetRegion, targetFullName, allRegionRows);

    // 후보 와인 맵 (item_code → wine meta)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wineMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const w of (wines || []) as any[]) wineMap.set(w.item_code, w);

    // 후보 빌드 (재고 충분 + 자기 자신 제외 + 타입 매칭)
    const candidates: Candidate[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inv of (inventory || []) as any[]) {
      if (inv.item_no === itemNo) continue;
      const totalStock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0);
      if (totalStock <= 0) continue;
      const price = inv.supply_price || 0;
      if (totalStock < minStockForPrice(price, SR)) continue;

      const wine = wineMap.get(inv.item_no);
      const fullName = `${wine?.item_name_kr || ''} ${wine?.item_name_en || ''}`;
      const wineType = normalizeType(wine?.wine_type || null, fullName || inv.item_name || '');

      // 타입 확인된 경우만 + 타입 일치 강제 (화이트↔레드 절대 안 됨)
      if (!wineType) continue;
      if (targetType && wineType !== targetType) continue;

      const wineRegion = wine?.region || '';
      const hierarchy = findHierarchy(wineRegion, fullName, allRegionRows);

      candidates.push({
        item_no: inv.item_no,
        item_name: wine?.item_name_kr || inv.item_name || '',
        country: (wine?.country_en || inv.country || '').toLowerCase(),
        region: wineRegion,
        grape: wine?.grape_varieties || '',
        wine_type: wineType,
        price,
        stock: totalStock,
        hierarchy,
      });
    }

    // 이름 기반 빈티지 매칭용 base name 미리 계산
    const targetBaseName = (targetWine?.item_name_kr || targetInv?.item_name || '')
      .replace(/["'「」]/g, '')
      .replace(/\d{2,4}\s*(빈티지|VT|vintage)?/gi, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();

    // 6단계 지역 확장 탐색
    const top = findAlternatives(candidates, {
      itemNo,
      targetHierarchy,
      targetGrapes,
      targetCountry,
      targetPrice,
      targetWineName: targetName,
      targetBaseName,
    });

    return NextResponse.json({
      target: {
        item_no: itemNo,
        item_name: targetName,
        grape: targetWine?.grape_varieties || '',
        wine_type: targetType || targetWine?.wine_type || '',
        country: targetWine?.country_en || targetInv?.country || '',
        region: targetRegion,
        price: targetPrice,
        hierarchy: targetHierarchy,
      },
      alternatives: top,
    });
  } catch (error) {
    console.error('Alternatives GET error:', error);
    return NextResponse.json(
      { error: '대체 와인 추천 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
