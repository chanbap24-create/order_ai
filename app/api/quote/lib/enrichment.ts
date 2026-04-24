/**
 * quote_items 조회·생성 시 공용으로 쓰이는 enrichment 유틸.
 *
 *  - extractVintage : item_code[2:4] 에서 빈티지 추출 (NV/MV 허용)
 *  - removePrefix   : "BL 마르기스" 같은 2자 알파벳 prefix 제거
 *  - fetchBarcodes  : CDV → DL 순 fallback 으로 barcode Map 일괄 조회
 */

import { supabase } from '@/app/lib/db';

export function extractVintage(itemCode: string): string {
  if (!itemCode || itemCode.length < 4) return '';
  const vPart = itemCode.substring(2, 4);
  const upper = vPart.toUpperCase();
  if (upper === 'NV' || upper === 'MV') return upper;
  if (!/^\d{2}$/.test(vPart)) return vPart;
  const num = parseInt(vPart, 10);
  return num >= 50 ? `19${vPart}` : `20${vPart}`;
}

export function removePrefix(name: string): string {
  if (!name) return '';
  return name.replace(/^[A-Za-z]{2}\s+/, '').trim();
}

/**
 * item_codes 배열에 대해 barcode 를 일괄 조회.
 *  - CDV 재고 먼저 조회
 *  - CDV 에 없는 코드만 DL 재고에서 fallback
 */
export async function fetchBarcodes(itemCodes: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (itemCodes.length === 0) return map;

  const { data: cdvRows } = await supabase
    .from('inventory_cdv')
    .select('item_no, barcode')
    .in('item_no', itemCodes);
  for (const r of (cdvRows || []) as Array<{ item_no: string; barcode: string | null }>) {
    if (r.barcode) map[r.item_no] = r.barcode;
  }

  const missing = itemCodes.filter((c) => !map[c]);
  if (missing.length > 0) {
    const { data: dlRows } = await supabase
      .from('inventory_dl')
      .select('item_no, barcode')
      .in('item_no', missing);
    for (const r of (dlRows || []) as Array<{ item_no: string; barcode: string | null }>) {
      if (r.barcode) map[r.item_no] = r.barcode;
    }
  }

  return map;
}
