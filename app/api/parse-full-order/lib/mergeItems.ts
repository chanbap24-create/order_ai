import { logger } from "@/app/lib/logger";

/**
 * 같은 item_no 아이템 통합 (수량 합산).
 * 미확정 아이템은 고유 키로 그대로 유지.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeResolvedItems(items: any[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemMap = new Map<string, any>();

  for (const item of items) {
    logger.debug(`[MERGE DEBUG] Processing`, { resolved: item.resolved, item_no: item.item_no, qty: item.qty });

    if (item.resolved && item.item_no) {
      const key = String(item.item_no);
      const existing = itemMap.get(key);
      if (existing) {
        logger.debug(`[MERGE DEBUG] 중복 → 수량 합산`, { key, prev: existing.qty, add: item.qty });
        existing.qty = (existing.qty || 0) + (item.qty || 0);
      } else {
        itemMap.set(key, { ...item });
      }
    } else {
      const unresolvedKey = `unresolved_${Date.now()}_${Math.random()}`;
      itemMap.set(unresolvedKey, { ...item });
    }
  }

  return Array.from(itemMap.values());
}
