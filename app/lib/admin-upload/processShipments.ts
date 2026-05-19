import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import type { ShipmentRow } from "./types";

export async function processShipmentsFromData(
  shipments: ShipmentRow[],
  table: 'shipments' | 'glass_shipments',
  clear: boolean,
  minDate?: string
) {
  if (clear) {
    await supabase.from(table).delete().not('id', 'is', null);
    logger.info(`[Shipments] Cleared ${table}`);
  } else if (minDate) {
    // append 모드: minDate 이후 기존 행만 삭제 (중복 방지)
    const { error } = await supabase.from(table).delete().gte('ship_date', minDate);
    if (error) {
      logger.error(`[Shipments] ${table} partial delete error`, { error });
    } else {
      logger.info(`[Shipments] Deleted ${table} rows where ship_date >= ${minDate}`);
    }
  }

  let inserted = 0;
  for (let i = 0; i < shipments.length; i += 500) {
    const batch = shipments.slice(i, i + 500).map(s => ({
      ...s,
      quantity: Math.round(s.quantity ?? 0),
      unit_price: s.unit_price != null ? Math.round(s.unit_price) : null,
      selling_price: s.selling_price != null ? Math.round(s.selling_price) : null,
      supply_amount: s.supply_amount != null ? Math.round(s.supply_amount) : null,
      tax_amount: s.tax_amount != null ? Math.round(s.tax_amount) : null,
      total_amount: s.total_amount != null ? Math.round(s.total_amount) : null,
    }));
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      logger.error(`[Shipments] ${table} insert error at batch ${i}`, { error });
      throw new Error(`${table} insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[Shipments] Inserted ${inserted} rows into ${table}`);

  // ── 마스터 동기화: 새 거래처가 출고에만 들어가고 마스터에 누락되던 root cause fix ──
  // 출고 row들에서 distinct (client_code, client_name) 을 뽑아 마스터 테이블에 upsert.
  // onConflict: do nothing — 기존 row 의 manager/importance 등은 덮어쓰지 않는다.
  const syncedClients = await syncClientMasters(shipments, table);
  if (syncedClients > 0) {
    logger.info(`[Shipments] Synced ${syncedClients} new clients into master table`);
  }

  return { inserted, masterSynced: syncedClients };
}

/**
 * 출고 row 들에서 distinct 거래처를 추출해 마스터 테이블에 신규 row만 INSERT 한다.
 *  - shipments       → client_details (client_type='wine')
 *  - glass_shipments → glass_clients
 *
 * 기존 row 는 onConflict='client_code' do nothing 으로 보호 (담당자 등 사람이 손댄
 * 마스터 정보가 출고 업로드 한 번에 덮여쓰여지는 사고 방지).
 */
async function syncClientMasters(
  shipments: ShipmentRow[],
  table: 'shipments' | 'glass_shipments',
): Promise<number> {
  // distinct (client_code, client_name) — 같은 코드면 가장 마지막으로 등장한 이름 사용
  const seen = new Map<string, { client_name: string; manager: string | null }>();
  for (const s of shipments) {
    const code = (s.client_code || '').trim();
    const name = (s.client_name || '').trim();
    if (!code || !name) continue;
    seen.set(code, { client_name: name, manager: s.manager?.trim() || null });
  }
  if (seen.size === 0) return 0;

  const masterTable = table === 'glass_shipments' ? 'glass_clients' : 'client_details';
  const rows = Array.from(seen.entries()).map(([code, v]) => {
    if (masterTable === 'client_details') {
      return {
        client_code: code,
        client_name: v.client_name,
        client_type: 'wine' as const,
        ...(v.manager ? { manager: v.manager } : {}),
      };
    }
    return { client_code: code, client_name: v.client_name };
  });

  // ignoreDuplicates: true → 기존 row 보호, 신규만 insert
  let synced = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from(masterTable)
      .upsert(batch, { onConflict: 'client_code', ignoreDuplicates: true, count: 'exact' });
    if (error) {
      logger.error(`[Shipments] ${masterTable} sync error at batch ${i}`, { error });
      // 마스터 동기화 실패해도 출고 자체는 이미 성공 → throw 안 하고 warn 만.
      continue;
    }
    synced += count ?? 0;
  }
  return synced;
}
