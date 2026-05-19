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

  // ── 마스터 동기화 ──
  // 1) 신규 거래처 → 마스터(client_details / glass_clients) 자동 등록
  // 2) 기존 거래처의 담당자(manager) → 이번 출고의 최신 manager 로 업데이트
  //    (인수인계 등으로 담당자가 바뀌어도 권한·검색이 즉시 따라가도록)
  const syncResult = await syncClientMasters(shipments, table);
  if (syncResult.inserted > 0 || syncResult.managerUpdated > 0) {
    logger.info(
      `[Shipments] Master synced — inserted ${syncResult.inserted} new clients, ` +
      `updated manager for ${syncResult.managerUpdated} existing clients`,
    );
  }

  return {
    inserted,
    masterSynced: syncResult.inserted,
    managerUpdated: syncResult.managerUpdated,
  };
}

/**
 * 출고 row 들에서 distinct 거래처를 추출해 마스터 테이블에 동기화한다.
 *  - shipments       → client_details (client_type='wine')
 *  - glass_shipments → glass_clients (신규 등록만; manager 컬럼 없음)
 *                     + client_details (해당 코드의 row가 있을 때 manager 업데이트)
 *
 * 신규 row 는 ignoreDuplicates=true 로 안전 INSERT.
 * 기존 row 의 manager 는 이번 업로드의 최신 manager 로 그룹 단위 UPDATE
 * (인수인계 자동 반영). manager 가 빈 출고는 업데이트 대상에서 제외 → 사람이 손댄
 * 정보가 빈 출고 한 건 때문에 지워지는 사고 방지.
 */
async function syncClientMasters(
  shipments: ShipmentRow[],
  table: 'shipments' | 'glass_shipments',
): Promise<{ inserted: number; managerUpdated: number }> {
  // distinct (client_code → 가장 마지막 등장한 name, manager) 추출
  const seen = new Map<string, { client_name: string; manager: string | null }>();
  for (const s of shipments) {
    const code = (s.client_code || '').trim();
    const name = (s.client_name || '').trim();
    if (!code || !name) continue;
    seen.set(code, { client_name: name, manager: s.manager?.trim() || null });
  }
  if (seen.size === 0) return { inserted: 0, managerUpdated: 0 };

  // ── 1) 신규 INSERT (양쪽 마스터 모두 처리) ──
  const isGlass = table === 'glass_shipments';
  const insertResults: Array<Promise<void>> = [];

  // 1-a) wine: client_details (client_type='wine'), glass: glass_clients (manager 컬럼 없음)
  const primaryMaster = isGlass ? 'glass_clients' : 'client_details';
  const primaryRows = Array.from(seen.entries()).map(([code, v]) => {
    if (isGlass) return { client_code: code, client_name: v.client_name };
    return {
      client_code: code,
      client_name: v.client_name,
      client_type: 'wine' as const,
      ...(v.manager ? { manager: v.manager } : {}),
    };
  });

  let inserted = 0;
  for (let i = 0; i < primaryRows.length; i += 500) {
    const batch = primaryRows.slice(i, i + 500);
    const { error, count } = await supabase
      .from(primaryMaster)
      .upsert(batch, { onConflict: 'client_code', ignoreDuplicates: true, count: 'exact' });
    if (error) {
      logger.error(`[Shipments] ${primaryMaster} insert error at batch ${i}`, { error });
      continue;
    }
    inserted += count ?? 0;
  }
  void insertResults;

  // ── 2) 기존 row 의 manager UPDATE ──
  // shipments → client_details.manager (client_type 무관: 인수인계 시 wine/glass 둘 다 반영)
  // glass_shipments → glass_clients 는 manager 컬럼이 없어 client_details 만 업데이트
  //   (client_details 에 같은 client_code 가 등록돼 있는 경우에만 작동)
  // glass_client_carryover.manager 도 함께 업데이트해 authz fallback 일관성 유지
  let managerUpdated = 0;
  const managerGroups = new Map<string, string[]>();
  for (const [code, v] of seen) {
    if (!v.manager) continue;
    if (!managerGroups.has(v.manager)) managerGroups.set(v.manager, []);
    managerGroups.get(v.manager)!.push(code);
  }

  for (const [mgr, codes] of managerGroups) {
    for (let i = 0; i < codes.length; i += 200) {
      const chunk = codes.slice(i, i + 200);
      const targets: Array<Promise<{ error: unknown }>> = [
        supabase.from('client_details').update({ manager: mgr }).in('client_code', chunk),
      ];
      if (isGlass) {
        targets.push(
          supabase.from('glass_client_carryover').update({ manager: mgr }).in('client_code', chunk),
        );
      }
      const results = await Promise.all(targets);
      for (const r of results) {
        if (r.error) {
          logger.error(`[Shipments] manager update error`, { error: r.error, mgr });
        }
      }
      managerUpdated += chunk.length;
    }
  }

  return { inserted, managerUpdated };
}
