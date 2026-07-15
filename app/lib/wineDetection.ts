// 신규 와인 감지 로직 (Supabase) - 배치 최적화

import { supabase } from "@/app/lib/db";
import { ensureWineTables } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { getCountryPair } from "@/app/lib/countryMapping";
import { loadBrandSupplierMap, supplierFromMap } from "@/app/lib/brandMapping";
import { translateWineName } from "@/app/lib/koreanToEnglish";
import { extractVintage } from "@/app/api/quote/lib/enrichment";
import { logger } from "@/app/lib/logger";

/** 빈티지는 품번 3~4자리(공식) 우선 — ERP 엑셀 빈티지 컬럼 오입력 방지. 코드가 연도를 못 주면 엑셀값 폴백. */
function codeVintage(itemNo: string, excelVintage: string | null): string | null {
  const c = extractVintage(itemNo);
  if (/^(19|20)\d{2}$/.test(c) || c === "NV" || c === "MV") return c;
  return excelVintage ?? null;
}

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
    // 페이지네이션 필수: 재고가 1000행을 넘으면 기본 상한에 잘려 일부 신규가 감지 누락됨.
    const PAGE = 1000;
    const out: InventoryItem[] = [];
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await supabase
        .from('inventory_cdv')
        .select('item_no, item_name, supply_price, available_stock, vintage, alcohol_content, country')
        .range(off, off + PAGE - 1);
      if (error) throw error;
      const rows = data || [];
      out.push(...rows.map((r: any) => ({ ...r, alcohol: r.alcohol_content })) as InventoryItem[]);
      if (rows.length < PAGE) break;
    }
    return out;
  } catch (e) {
    logger.error(`[WineDetection] Failed to load inventory_cdv`, e instanceof Error ? e : undefined);
    return [];
  }
}

/** wines 테이블 전체를 로드하여 Map으로 반환.
 *  ⚠️ 페이지네이션 필수: select('*')만 하면 Supabase 기본 상한(1000행)에 잘려
 *  기존 와인이 맵에서 누락 → 신규로 오분류 → insert 중복키로 배치 전체 실패(신규 감지 먹통). */
async function loadAllWinesMap(): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await supabase.from('wines').select('*').range(off, off + PAGE - 1);
    if (error) {
      logger.error('[WineDetection] Failed to load wines', { error });
      break;
    }
    const rows = data || [];
    for (const w of rows) map.set(w.item_code, w);
    if (rows.length < PAGE) break;
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

  // 브랜드 약어 → 공급자명 맵 (하드코딩 + 브랜드 자료실). 약어를 보고 공급자명 자동 기입.
  const brandMap = await loadBrandSupplierMap();

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
      const supplierInfo = supplierFromMap(brandCode, brandMap);
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
        vintage: codeVintage(item.item_no, item.vintage),
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
        vintage: codeVintage(item.item_no, item.vintage),
        alcohol: item.alcohol,
        country: existing.country || kr || item.country,
        country_en: existing.country_en || en,
        // status='new'인 와인은 사용자가 확인할 때까지 유지
        status: existing.status === 'new' ? 'new' : 'active',
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
        const supplierInfo = supplierFromMap(brandCode || existing.brand, brandMap);
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

  // inventory_cdv → wines country backfill (빈 값 채우기)
  const backfilled = await backfillWineCountry();
  // 주: 와인리스트 빈칸 보강(형제 상속·노트·LLM)은 여기서 하지 않는다 — 업로드 응답을 수 분 잡아먹어
  // downloads-detect 라우트가 응답 후(after)에 비동기로 실행한다.

  logger.info(`[WineDetection] Result: ${newRows.length} new, ${updateRows.length} updated, ${backfilled} country-backfilled`);
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

/** wines 테이블 국가 데이터 backfill:
 *  1) country 비어있으면 → inventory_cdv.country 또는 country_en에서 역변환
 *  2) country_en 비어있으면 → country에서 변환
 */
export async function backfillWineCountry(): Promise<number> {
  let filled = 0;

  // ── 1. country 비어있는 와인: inventory_cdv 또는 country_en에서 채우기 ──
  const { data: noCountry } = await supabase
    .from('wines')
    .select('item_code, country_en')
    .or('country.is.null,country.eq.');

  if (noCountry && noCountry.length > 0) {
    const codes = noCountry.map((w: any) => w.item_code);

    // inventory_cdv에서 country 가져오기
    const { data: invItems } = await supabase
      .from('inventory_cdv')
      .select('item_no, country')
      .in('item_no', codes)
      .not('country', 'is', null);

    const invMap = new Map<string, string>();
    for (const inv of invItems || []) {
      if (inv.country) invMap.set(inv.item_no, inv.country);
    }

    for (const w of noCountry) {
      const source = invMap.get(w.item_code) || w.country_en || '';
      if (!source) continue;
      const { kr, en } = getCountryPair(source);
      const { error } = await supabase.from('wines')
        .update({ country: kr || source, country_en: en || source, updated_at: new Date().toISOString() })
        .eq('item_code', w.item_code);
      if (!error) filled++;
    }
  }

  // ── 2. country_en 비어있지만 country는 있는 와인: 영문 국가 채우기 ──
  const { data: noCountryEn } = await supabase
    .from('wines')
    .select('item_code, country')
    .not('country', 'is', null)
    .neq('country', '')
    .or('country_en.is.null,country_en.eq.');

  if (noCountryEn && noCountryEn.length > 0) {
    for (const w of noCountryEn) {
      const { en } = getCountryPair(w.country);
      if (!en) continue;
      const { error } = await supabase.from('wines')
        .update({ country_en: en, updated_at: new Date().toISOString() })
        .eq('item_code', w.item_code);
      if (!error) filled++;
    }
  }

  if (filled > 0) {
    logger.info(`[WineDetection] backfillWineCountry: ${filled} wines updated`);
  }
  return filled;
}
