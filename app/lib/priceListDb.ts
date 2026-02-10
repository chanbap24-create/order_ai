// 가격리스트 DB 헬퍼
// 가격 변동 조회 및 관련 유틸

import { db } from "@/app/lib/db";
import { ensureWineTables } from "@/app/lib/wineDb";
import type { PriceHistoryEntry } from "@/app/types/wine";

/** 최근 가격 변동 내역 조회 */
export function getRecentPriceChanges(days: number = 30): PriceHistoryEntry[] {
  ensureWineTables();
  return db.prepare(`
    SELECT * FROM price_history
    WHERE detected_at > datetime('now', '-' || ? || ' days')
    ORDER BY detected_at DESC
  `).all(days) as PriceHistoryEntry[];
}

/** 특정 와인의 가격 이력 조회 */
export function getPriceHistory(itemCode: string): PriceHistoryEntry[] {
  ensureWineTables();
  return db.prepare(`
    SELECT * FROM price_history
    WHERE item_code = ?
    ORDER BY detected_at DESC
  `).all(itemCode) as PriceHistoryEntry[];
}

// detectPriceChanges는 wineDetection.ts에 구현됨
export { detectPriceChanges } from "@/app/lib/wineDetection";
