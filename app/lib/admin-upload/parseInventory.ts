import { HEADER_MAP, TEXT_COLUMNS } from "@/app/lib/inventoryHeaders";
import { normCode, normText, toNumber } from "./utils";

/**
 * 재고 엑셀 시트를 동적 헤더 기반으로 파싱
 * - row[0]에서 헤더를 읽고 HEADER_MAP으로 DB 컬럼명에 매핑
 * - 매핑되지 않는 컬럼은 extra_data JSONB에 저장
 */
export function parseInventorySheet(rows: unknown[][]): Record<string, unknown>[] {
  if (rows.length < 2) return [];

  // 1. 헤더 행에서 컬럼 인덱스 매핑
  const headerRow = (rows[0] || []) as unknown[];
  const colMap: Array<{ idx: number; dbCol: string }> = [];
  const unmappedHeaders: Array<{ idx: number; header: string }> = [];

  for (let idx = 0; idx < headerRow.length; idx++) {
    const header = String(headerRow[idx] ?? '').trim();
    if (!header) continue;

    const dbCol = HEADER_MAP[header];
    if (dbCol) {
      colMap.push({ idx, dbCol });
    } else {
      unmappedHeaders.push({ idx, header });
    }
  }

  // 2. 데이터 행 파싱
  const results: Record<string, unknown>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const obj: Record<string, unknown> = {};

    for (const cm of colMap) {
      const raw = r[cm.idx];
      if (TEXT_COLUMNS.has(cm.dbCol)) {
        obj[cm.dbCol] = cm.dbCol === 'item_no' ? normCode(raw) : normText(raw);
      } else {
        obj[cm.dbCol] = toNumber(raw);
      }
    }

    // item_no 필수
    if (!obj.item_no) continue;

    // 매핑되지 않은 컬럼 → extra_data
    const extra: Record<string, unknown> = {};
    for (const um of unmappedHeaders) {
      const val = r[um.idx];
      if (val != null && String(val).trim() !== '') {
        extra[um.header] = val;
      }
    }
    if (Object.keys(extra).length > 0) {
      obj.extra_data = extra;
    }

    // 타사(위탁) 품목은 품명이 "(수입사)..." 로 시작 — 수입사 컬럼이 비어 있으면 추출해 저장
    if (!obj.importer && typeof obj.item_name === 'string') {
      const m = obj.item_name.match(/^\(([^)]{2,15})\)/);
      if (m) obj.importer = m[1];
    }

    // 매장(백화점) 재고는 백화점 팀 전용 — ERP 재고수량·가용재고에 합산돼 오므로 차감해
    // 영업 화면(인벤토리·추천·알림)에는 영업 가용분만 보이게 한다. 원수치 = 가용재고 + 매장합.
    const storeSum = ['store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai']
      .reduce((s, c) => s + (Number(obj[c]) || 0), 0);
    if (storeSum > 0) {
      for (const c of ['total_stock', 'stock_excl_available', 'available_stock']) {
        if (typeof obj[c] === 'number') obj[c] = Math.max(0, (obj[c] as number) - storeSum);
      }
    }

    obj.updated_at = new Date().toISOString();
    results.push(obj);
  }

  return results;
}
