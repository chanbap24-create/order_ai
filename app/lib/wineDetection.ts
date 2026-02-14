// 신규 와인 감지 로직 (Supabase) - 배치 최적화

import { supabase } from "@/app/lib/db";
import { ensureWineTables } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { getCountryPair } from "@/app/lib/countryMapping";
import { getSupplierByBrand } from "@/app/lib/brandMapping";
import { translateWineName } from "@/app/lib/koreanToEnglish";
import { logger } from "@/app/lib/logger";

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number | null;
  available_stock: number | null;
  vintage: string | null;
  alcohol: string | null;
  country: string | null;
}

async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, supply_price, available_stock, vintage, alcohol_content, country');
    if (error) throw error;
    return (data || []).map((r: any) => ({ ...r, alcohol: r.alcohol_content })) as InventoryItem[];
  } catch (e) {
    logger.error(`[WineDetection] Failed to load inventory_cdv`, e instanceof Error ? e : undefined);
    return [];
  }
}

/** wines 테이블 전체를 한번에 로드하여 Map으로 반환 */
async function loadAllWinesMap(): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const { data, error } = await supabase.from('wines').select('*');
  if (error) {
    logger.error('[WineDetection] Failed to load wines', { error });
    return map;
  }
  for (const w of data || []) {
    map.set(w.item_code, w);
  }
  return map;
}

export async function detectNewWines(): Promise<{ newCount: number; updatedCount: number }> {
  logger.info(`[WineDetection] detectNewWines() called`);

  const items = await getInventoryItems();
  if (items.length === 0) {
    return { newCount: 0, updatedCount: 0 };
  }

  const winesMap = await loadAllWinesMap();
  const wineCount = winesMap.size;
  logger.info(`[WineDetection] wines table: ${wineCount} existing, inventory: ${items.length} items`);

  // 신규/업데이트 분류
  const newRows: any[] = [];
  const updateRows: any[] = [];

  for (const item of items) {
    if (!item.item_no) continue;
    const { kr, en } = getCountryPair(item.country || '');
    const existing = winesMap.get(item.item_no);

    // 품명에서 브랜드 약어 추출 (예: "CH 찰스 하이직..." 또는 "MD마르셀..." → brand 분리)
    let brandCode: string | null = null;
    let cleanName = item.item_name;
    const brandMatch = (item.item_name || '').match(/^([A-Z]{2,4})\s*([가-힣].+)/);
    if (brandMatch) {
      brandCode = brandMatch[1];
      cleanName = brandMatch[2];
    }

    if (!existing) {
      const supplierInfo = getSupplierByBrand(brandCode);
      const autoEnName = translateWineName(cleanName);
      newRows.push({
        item_code: item.item_no,
        item_name_kr: cleanName,
        item_name_en: autoEnName,
        brand: brandCode,
        supplier: supplierInfo?.en || null,
        supplier_kr: supplierInfo?.kr || null,
        country: kr || item.country,
        country_en: en,
        vintage: item.vintage,
        alcohol: item.alcohol,
        supply_price: item.supply_price,
        available_stock: item.available_stock,
        status: 'new',
      });
    } else {
      const update: any = {
        item_code: item.item_no,
        item_name_kr: existing.item_name_kr || cleanName,
        supply_price: item.supply_price,
        available_stock: item.available_stock,
        vintage: item.vintage,
        alcohol: item.alcohol,
        country: existing.country || kr || item.country,
        country_en: existing.country_en || en,
        status: 'active',
        updated_at: new Date().toISOString(),
      };
      if (brandCode && !existing.brand) update.brand = brandCode;
      // 영문명 비어있으면 한글명에서 자동 변환
      if (!existing.item_name_en) {
        const autoEnName = translateWineName(existing.item_name_kr || cleanName);
        if (autoEnName) update.item_name_en = autoEnName;
      }
      // 공급자명 비어있으면 브랜드 약어로 자동 기입
      if (!existing.supplier || !existing.supplier_kr) {
        const supplierInfo = getSupplierByBrand(brandCode || existing.brand);
        if (supplierInfo) {
          if (!existing.supplier) update.supplier = supplierInfo.en;
          if (!existing.supplier_kr) update.supplier_kr = supplierInfo.kr;
        }
      }
      updateRows.push(update);
    }
  }

  // 배치 insert 신규 와인
  for (let i = 0; i < newRows.length; i += 500) {
    const { error } = await supabase.from('wines').insert(newRows.slice(i, i + 500));
    if (error) logger.error(`[WineDetection] insert batch error`, { error });
  }

  // 기존 와인 개별 update (수동 편집 필드 보존)
  for (let i = 0; i < updateRows.length; i += 50) {
    const batch = updateRows.slice(i, i + 50);
    await Promise.all(batch.map(async (row: any) => {
      const code = row.item_code;
      const updates = { ...row };
      delete updates.item_code;
      const { error } = await supabase.from('wines').update(updates).eq('item_code', code);
      if (error) logger.error(`[WineDetection] update error for ${code}`, { error });
    }));
  }

  // 변동 로그 (신규만 요약 기록)
  if (newRows.length > 0) {
    await logChange('new_wine_detected', 'wine', 'bulk', {
      count: newRows.length,
      samples: newRows.slice(0, 5).map(r => r.item_code),
    });
  }

  // 재고 목록에 없는 기존 와인은 discontinued
  if (wineCount > 0 && items.length > 0) {
    const currentCodes = new Set(items.map(i => i.item_no).filter(Boolean));
    const toDiscontinueCodes: string[] = [];
    for (const [code, wine] of winesMap) {
      if (!currentCodes.has(code) && wine.status !== 'discontinued') {
        toDiscontinueCodes.push(code);
      }
    }

    if (toDiscontinueCodes.length > 0) {
      // 배치로 discontinued 처리
      for (let i = 0; i < toDiscontinueCodes.length; i += 500) {
        const batch = toDiscontinueCodes.slice(i, i + 500);
        await supabase.from('wines').update({
          status: 'discontinued',
          available_stock: 0,
          updated_at: new Date().toISOString(),
        }).in('item_code', batch);
      }
      await logChange('wines_discontinued', 'wine', 'bulk', { count: toDiscontinueCodes.length });
    }
  }

  logger.info(`[WineDetection] Result: ${newRows.length} new wines, ${updateRows.length} updated`);
  return { newCount: newRows.length, updatedCount: updateRows.length };
}

export async function detectPriceChanges(): Promise<number> {
  const items = await getInventoryItems();
  if (items.length === 0) return 0;

  const winesMap = await loadAllWinesMap();
  if (winesMap.size === 0) return 0;

  const priceChanges: any[] = [];
  const changeLogs: any[] = [];

  for (const item of items) {
    if (!item.item_no || item.supply_price == null) continue;

    const existing = winesMap.get(item.item_no);
    if (!existing || existing.supply_price == null) continue;

    if (existing.supply_price !== item.supply_price) {
      const changePct = existing.supply_price > 0
        ? ((item.supply_price - existing.supply_price) / existing.supply_price) * 100
        : null;

      priceChanges.push({
        item_code: item.item_no,
        field_name: 'supply_price',
        old_value: existing.supply_price,
        new_value: item.supply_price,
        change_pct: changePct,
      });

      changeLogs.push({
        old_price: existing.supply_price,
        new_price: item.supply_price,
        change_pct: changePct?.toFixed(1),
        item_code: item.item_no,
      });
    }
  }

  // 배치 insert price_history
  for (let i = 0; i < priceChanges.length; i += 500) {
    const { error } = await supabase.from('price_history').insert(priceChanges.slice(i, i + 500));
    if (error) logger.error(`[WineDetection] price_history insert error`, { error });
  }

  // 변동 로그 요약
  if (priceChanges.length > 0) {
    await logChange('price_changed', 'wine', 'bulk', {
      count: priceChanges.length,
      samples: changeLogs.slice(0, 5),
    });
    logger.info(`Price detection: ${priceChanges.length} price changes detected`);
  }

  return priceChanges.length;
}
