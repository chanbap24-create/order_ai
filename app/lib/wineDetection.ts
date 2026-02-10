// 신규 와인 감지 로직
// Downloads(와인재고현황) 업로드 시 기존 wines 테이블과 비교하여 신규 와인 감지

import { db } from "@/app/lib/db";
import { ensureWineTables, getWineByCode } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { getCountryPair } from "@/app/lib/countryMapping";
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

/** inventory_cdv 테이블에서 현재 재고 목록 가져오기 */
function getInventoryItems(): InventoryItem[] {
  try {
    return db.prepare(`
      SELECT item_no, item_name, supply_price, available_stock, vintage, alcohol_content as alcohol, country
      FROM inventory_cdv
    `).all() as InventoryItem[];
  } catch {
    return [];
  }
}

/** 신규 와인 감지 및 등록 */
export function detectNewWines(): { newCount: number; updatedCount: number } {
  ensureWineTables();

  const items = getInventoryItems();
  if (items.length === 0) return { newCount: 0, updatedCount: 0 };

  // wines 테이블이 비어있으면 첫 업로드 → 모두 'active'로 등록 (신규 아님)
  const wineCount = (db.prepare('SELECT COUNT(*) as cnt FROM wines').get() as { cnt: number }).cnt;
  const isFirstLoad = wineCount === 0;

  let newCount = 0;
  let updatedCount = 0;

  const insertWine = db.prepare(`
    INSERT INTO wines (item_code, item_name_kr, country, country_en, vintage, alcohol, supply_price, available_stock, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateWine = db.prepare(`
    UPDATE wines SET
      item_name_kr = ?,
      supply_price = ?,
      available_stock = ?,
      vintage = ?,
      alcohol = ?,
      country = ?,
      country_en = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE item_code = ?
  `);

  db.transaction(() => {
    for (const item of items) {
      if (!item.item_no) continue;

      const existing = getWineByCode(item.item_no);
      const { kr, en } = getCountryPair(item.country || '');

      if (!existing) {
        const status = isFirstLoad ? 'active' : 'new';
        insertWine.run(
          item.item_no,
          item.item_name,
          kr || item.country,
          en,
          item.vintage,
          item.alcohol,
          item.supply_price,
          item.available_stock,
          status
        );

        if (!isFirstLoad) {
          newCount++;
          logChange('new_wine_detected', 'wine', item.item_no, {
            item_name: item.item_name,
            country: item.country,
            supply_price: item.supply_price,
          });
        }
      } else {
        // 기존 와인 - 재고/가격 업데이트
        updateWine.run(
          item.item_name,
          item.supply_price,
          item.available_stock,
          item.vintage,
          item.alcohol,
          kr || item.country,
          en,
          item.item_no
        );
        updatedCount++;
      }
    }

    // 재고 목록에 없는 와인은 discontinued로 변경 (첫 업로드가 아닌 경우에만)
    const currentCodes = items.map((i) => i.item_no).filter(Boolean);
    if (!isFirstLoad && currentCodes.length > 0) {
      const placeholders = currentCodes.map(() => '?').join(',');
      const discontinued = db.prepare(`
        UPDATE wines SET status = 'discontinued', available_stock = 0, updated_at = CURRENT_TIMESTAMP
        WHERE item_code NOT IN (${placeholders}) AND status != 'discontinued'
      `).run(...currentCodes);

      if (discontinued.changes > 0) {
        logChange('wines_discontinued', 'wine', 'bulk', { count: discontinued.changes });
      }
    }
  })();

  if (newCount > 0) {
    logger.info(`Wine detection: ${newCount} new wines, ${updatedCount} updated`);
  }

  return { newCount, updatedCount };
}

/** 가격 변동 감지 */
export function detectPriceChanges(): number {
  ensureWineTables();

  const items = getInventoryItems();
  if (items.length === 0) return 0;

  let changeCount = 0;

  const insertHistory = db.prepare(`
    INSERT INTO price_history (item_code, field_name, old_value, new_value, change_pct)
    VALUES (?, 'supply_price', ?, ?, ?)
  `);

  db.transaction(() => {
    for (const item of items) {
      if (!item.item_no || item.supply_price == null) continue;

      const existing = getWineByCode(item.item_no);
      if (!existing || existing.supply_price == null) continue;

      if (existing.supply_price !== item.supply_price) {
        const changePct = existing.supply_price > 0
          ? ((item.supply_price - existing.supply_price) / existing.supply_price) * 100
          : null;

        insertHistory.run(item.item_no, existing.supply_price, item.supply_price, changePct);
        changeCount++;

        logChange('price_changed', 'wine', item.item_no, {
          old_price: existing.supply_price,
          new_price: item.supply_price,
          change_pct: changePct?.toFixed(1),
        });
      }
    }
  })();

  if (changeCount > 0) {
    logger.info(`Price detection: ${changeCount} price changes detected`);
  }

  return changeCount;
}
