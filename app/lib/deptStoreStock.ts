// 백화점 매장 재고 스냅샷(dept_store_stock) — 매장 컬럼이 있는 확장 재고표에서만 갱신.
// 일일 영업 재고표(inventory_cdv)와 분리: 서로 다른 ERP 내보내기가 같은 테이블을 덮어쓰지 않게.
import { supabase } from './db';
import { logger } from './logger';

export const STORE_COLS = [
  'store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai',
] as const;

/** 파싱된 재고 행들이 백화점 확장 재고표(매장 컬럼 포함)인지 판별 */
export function hasStoreColumns(rows: Record<string, unknown>[]): boolean {
  return rows.some((r) => STORE_COLS.some((c) => c in r));
}

/** dept_store_stock 전체 교체 (매장 재고 있는 품목만 저장) */
export async function replaceDeptStoreStock(rows: Record<string, unknown>[]): Promise<number> {
  const mapped = rows
    .map((r) => {
      const stores = Object.fromEntries(STORE_COLS.map((c) => [c, Number(r[c]) || 0]));
      return {
        item_no: String(r.item_no || ''),
        item_name: String(r.item_name || ''),
        importer: String(r.importer || ''),
        retail_price: Number(r.retail_price) || 0,
        supply_price: Number(r.supply_price) || 0,
        ...stores,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.item_no && STORE_COLS.some((c) => (r as Record<string, number>)[c] > 0));

  await supabase.from('dept_store_stock').delete().not('item_no', 'is', null);
  for (let i = 0; i < mapped.length; i += 500) {
    const { error } = await supabase.from('dept_store_stock').upsert(mapped.slice(i, i + 500), { onConflict: 'item_no' });
    if (error) throw new Error(`dept_store_stock upsert failed: ${error.message}`);
  }
  logger.info(`[DeptStock] 백화점 매장 재고 ${mapped.length}품목 갱신`);
  return mapped.length;
}
