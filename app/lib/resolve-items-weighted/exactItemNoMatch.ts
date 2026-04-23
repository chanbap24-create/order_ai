import { supabase } from "@/app/lib/db";
import { stripQtyAndUnit } from "./normalize";

export type ExactMatchResult = {
  item_no: string;
  item_name: string;
  score: number;
  method: string;
  resolved: boolean;
  supply_price?: number;
} | null;

/**
 * 0단계: 품목번호 정확 매칭 (최우선).
 * 예: "0884/33", "D701049" 같은 품목번호 직접 입력 케이스.
 *
 * 검색 전략:
 *   1) 와인잔 패턴 ("RD 0884/33 ...") — 거래처 이력 → 마스터
 *   2) item_no 정확 일치 — 거래처 이력 → inventory_cdv → master_items
 */
export async function tryExactItemNoMatch(
  searchName: string,
  clientCode: string,
): Promise<ExactMatchResult> {
  const itemNoPattern = /^([A-Z]?\d{4,7}[\/-]?\d{0,3})$/i;
  const m = stripQtyAndUnit(searchName).trim().match(itemNoPattern);
  if (!m) return null;

  const inputItemNo = m[1].toUpperCase();
  console.log(`[ItemNo Exact] 품목번호 입력 감지: "${inputItemNo}"`);

  // ─ 1. 와인잔 패턴: 품목명 내부의 번호 매칭 ("RD 0884/33 ...")
  try {
    console.log(`[Glass Pattern] 와인잔 패턴 검색: "%RD ${inputItemNo}%"`);

    const { data: clientGlassRows } = await supabase
      .from('client_item_stats')
      .select('item_no, item_name')
      .eq('client_code', clientCode)
      .or(`item_name.ilike.%RD ${inputItemNo}%,item_name.ilike.%RD ${inputItemNo.replace(/\//g, '-')}%,item_name.ilike.%RD ${inputItemNo.replace(/[\/-]/g, '')}%`)
      .limit(1);
    const clientGlass = clientGlassRows?.[0] as any;
    if (clientGlass) {
      console.log(`[Glass Pattern] ✅ 거래처 이력에서 와인잔 발견: ${clientGlass.item_no}`);
      return {
        item_no: clientGlass.item_no,
        item_name: clientGlass.item_name,
        score: 1.0,
        method: "glass_pattern_client",
        resolved: true,
      };
    }

    const { data: masterGlassRows } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, supply_price')
      .or(`item_name.ilike.%RD ${inputItemNo}%,item_name.ilike.%RD ${inputItemNo.replace(/\//g, '-')}%,item_name.ilike.%RD ${inputItemNo.replace(/[\/-]/g, '')}%`)
      .limit(1);
    const masterGlass = masterGlassRows?.[0] as any;
    if (masterGlass) {
      console.log(`[Glass Pattern] ✅ 마스터에서 와인잔 발견: ${masterGlass.item_no}`);
      return {
        item_no: masterGlass.item_no,
        item_name: masterGlass.item_name,
        score: 1.0,
        method: "glass_pattern_master",
        resolved: false,
        supply_price: masterGlass.supply_price || masterGlass.price,
      };
    }
  } catch (e) {
    console.error('[Glass Pattern] 와인잔 패턴 검색 실패:', e);
  }

  // ─ 2. 거래처 이력 item_no 정확 일치
  const { data: clientExactRows } = await supabase
    .from('client_item_stats')
    .select('item_no, item_name')
    .eq('client_code', clientCode)
    .or(`item_no.eq.${inputItemNo},item_no.eq.${inputItemNo.replace(/\//g, '')},item_no.eq.${inputItemNo.replace(/-/g, '')}`)
    .limit(1);
  const clientExact = clientExactRows?.[0] as any;
  if (clientExact) {
    console.log(`[ItemNo Exact] ✅ 거래처 이력에서 발견: ${clientExact.item_no}`);
    return {
      item_no: clientExact.item_no,
      item_name: clientExact.item_name,
      score: 1.0,
      method: "item_no_exact_client",
      resolved: true,
    };
  }

  // ─ 3. 마스터 테이블 (inventory_cdv) item_no 정확 일치
  try {
    const { data: masterExactRows } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, supply_price')
      .or(`item_no.eq.${inputItemNo},item_no.eq.${inputItemNo.replace(/\//g, '')},item_no.eq.${inputItemNo.replace(/-/g, '')}`)
      .limit(1);
    const masterExact = masterExactRows?.[0] as any;
    if (masterExact) {
      console.log(`[ItemNo Exact] ✅ 마스터에서 발견: ${masterExact.item_no}`);
      return {
        item_no: masterExact.item_no,
        item_name: masterExact.item_name,
        score: 1.0,
        method: "item_no_exact_master",
        resolved: false,
        supply_price: masterExact.supply_price || masterExact.price,
      };
    }
  } catch (e) {
    console.error('[ItemNo Exact] 마스터 검색 실패:', e);
  }

  // ─ 4. master_items (신규 품목)
  try {
    const { data: newItemRows } = await supabase
      .from('master_items')
      .select('item_no, item_name, supply_price')
      .or(`item_no.eq.${inputItemNo},item_no.eq.${inputItemNo.replace(/\//g, '')},item_no.eq.${inputItemNo.replace(/-/g, '')}`)
      .limit(1);
    const newItemExact = newItemRows?.[0] as any;
    if (newItemExact) {
      console.log(`[ItemNo Exact] ✅ 신규 품목에서 발견: ${newItemExact.item_no}`);
      return {
        item_no: newItemExact.item_no,
        item_name: newItemExact.item_name,
        score: 1.0,
        method: "item_no_exact_new",
        resolved: false,
        supply_price: newItemExact.supply_price,
      };
    }
  } catch (e) {
    console.error('[ItemNo Exact] 신규 품목 검색 실패:', e);
  }

  console.log(`[ItemNo Exact] ❌ 품목번호를 찾을 수 없음: ${inputItemNo}`);
  return null;
}
