// app/lib/adminUpload.ts
// 관리자 엑셀 업로드 → DB 교체 로직 (Supabase)

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { ensureWineTables } from "@/app/lib/wineDb";
import { getCountryPair } from "@/app/lib/countryMapping";
import { recordInventoryValuePartial } from "@/app/lib/inventoryValueDb";

/* ─── 업로드 파일 저장 경로 ─── */
const UPLOAD_DIR = "/tmp/admin-uploads";

function saveUploadedFile(type: string, buf: Buffer) {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, `${type}.xlsx`);
    fs.writeFileSync(filePath, buf);
    logger.info(`Admin upload: saved file to ${filePath}`);
  } catch (e) {
    logger.warn("Failed to save uploaded file to /tmp (non-fatal)", { error: e });
  }
}

/** 저장된 업로드 파일 경로 반환 (없으면 null) */
export function getUploadedFilePath(type: string): string | null {
  const filePath = path.join(UPLOAD_DIR, `${type}.xlsx`);
  return fs.existsSync(filePath) ? filePath : null;
}

/** 모든 업로드 파일의 최종 수정 시간 반환 */
export function getAllUploadTimestamps(): Record<string, string | null> {
  const types = ["client", "dl-client", "riedel", "downloads", "dl", "english"];
  const result: Record<string, string | null> = {};
  for (const type of types) {
    const filePath = path.join(UPLOAD_DIR, `${type}.xlsx`);
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        result[type] = stat.mtime.toISOString();
      } else {
        result[type] = null;
      }
    } catch {
      result[type] = null;
    }
  }
  return result;
}

/* ─── 유틸 ─── */
function normCode(x: unknown) {
  return String(x ?? "").trim().replace(/\.0$/, "");
}
function normText(x: unknown) {
  return String(x ?? "").trim();
}
function toNumber(x: unknown): number | null {
  if (x == null) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ─── 재고 엑셀 헤더 → DB 컬럼 매핑 (동적 파싱) ─── */
// 관리자 업로드 엑셀 + 번들 엑셀 양쪽 포맷 모두 지원
const HEADER_MAP: Record<string, string> = {
  // 기본 정보
  '품번': 'item_no',
  '품명': 'item_name',
  '브랜드': 'brand',
  '수입사': 'importer',
  '용량': 'volume_ml',
  '빈티지': 'vintage',
  '알콜도수%': 'alcohol_content',
  '국가': 'country',
  '표준바코드': 'barcode',
  // 재고 수량 — 관리자 업로드 형식
  '재고수량(A)': 'total_stock',
  '재고수량(가용재고제외)(B)': 'stock_excl_available',
  '출고예정(C)': 'pending_shipment',
  '가용재고(B-C)': 'available_stock',
  // 재고 수량 — 번들 엑셀 형식 (변형 대응)
  '재고수량(B)': 'total_stock',
  '재고수량(가용재고제외)': 'stock_excl_available',
  '출고예정(B)': 'pending_shipment',
  '가용재고(A-B)': 'available_stock',
  // 출고 통계
  '30일출고': 'sales_30days',
  '90일/3평균출고': 'avg_sales_90d',
  '365일/12평균출고': 'avg_sales_365d',
  // 가격
  '공급가': 'supply_price',
  '판매가': 'retail_price',
  '할인공급가': 'discount_price',
  '도매장가': 'wholesale_price',
  '최저판매가': 'min_price',
  '미착품재고': 'incoming_stock',
  // 창고 — CDV (까브드뱅)
  '보세(용마)': 'bonded_warehouse',
  '용마로지스': 'yongma_logistics',
  '안성창고(CDV)': 'anseong_warehouse',
  // 창고 — DL (대유라이프)
  '보세(GIG)': 'bonded_warehouse',
  '안성창고(DL)': 'anseong_warehouse',
  'GIG': 'gig_warehouse',
  'GIG(마케팅부)': 'gig_marketing',
  'GIG(영업1부)': 'gig_sales1',
  // 변형 대응 (만일을 위해)
  '안성창고': 'anseong_warehouse',
  'GIG마케팅': 'gig_marketing',
  'GIG영업1': 'gig_sales1',
};

const TEXT_COLUMNS = new Set([
  'item_no', 'item_name', 'brand', 'importer', 'volume_ml',
  'vintage', 'alcohol_content', 'country', 'barcode',
]);

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

    obj.updated_at = new Date().toISOString();
    results.push(obj);
  }

  return results;
}

/* ─── 업로드 타입 정의 ─── */
export const UPLOAD_TYPES = {
  client: {
    label: "거래처별 와인 출고현황",
    description: "Client 시트 - 와인 거래처/품목 데이터",
  },
  "dl-client": {
    label: "거래처별 글라스 출고현황",
    description: "DL-Client 시트 - 글라스 거래처/품목 데이터",
  },
  riedel: {
    label: "리델리스트",
    description: "리델 가격 리스트",
  },
  downloads: {
    label: "와인재고현황",
    description: "와인 재고 현황 데이터",
  },
  dl: {
    label: "글라스재고현황",
    description: "글라스 재고 현황 데이터",
  },
  english: {
    label: "와인리스트",
    description: "와인 영문/한글 가격 리스트",
  },
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;

export function isValidUploadType(type: string): type is UploadType {
  return type in UPLOAD_TYPES;
}

/* ─── Client / DL-Client 공통 파서 ─── */
// Header row 0: 열1, 선택, 사업장, 출고번호, 판매처(4), 판매처번호(5), ...
// 품번(12), 품명(13), 판매단가(16), 기준단가(19)
function parseClientSheet(rows: unknown[][]) {
  const IDX_CLIENT_NAME = 4;
  const IDX_CLIENT_CODE = 5;
  const IDX_ITEM_NO = 12;
  const IDX_ITEM_NAME = 13;
  const IDX_SUPPLY_PRICE = 19;

  const clientMap = new Map<string, string>();
  const itemMap = new Map<
    string,
    { client_code: string; item_no: string; item_name: string; supply_price: number | null }
  >();

  for (let i = 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const client_name = normText(r[IDX_CLIENT_NAME]);
    const client_code = normCode(r[IDX_CLIENT_CODE]);
    if (!client_name || !client_code) continue;

    clientMap.set(client_code, client_name);

    const item_no = normCode(r[IDX_ITEM_NO]);
    const item_name = normText(r[IDX_ITEM_NAME]);
    if (!item_no || !item_name) continue;

    const supply_price = toNumber(r[IDX_SUPPLY_PRICE]);
    itemMap.set(`${client_code}||${item_no}`, {
      client_code,
      item_no,
      item_name,
      supply_price,
    });
  }

  return { clientMap, itemMap };
}

/* ─── Glass(DL-Client) 파서: 공급가 = Q(16) ─── */
function parseDlClientSheet(rows: unknown[][]) {
  const IDX_CLIENT_NAME = 4;
  const IDX_CLIENT_CODE = 5;
  const IDX_ITEM_NO = 12;
  const IDX_ITEM_NAME = 13;
  const IDX_GL_PRICE = 16;

  const clientMap = new Map<string, string>();
  const itemsMap = new Map<string, string>(); // itemNo -> itemName
  const clientItemsMap = new Map<
    string,
    { clientCode: string; itemNo: string; itemName: string; price: number }
  >();

  for (let i = 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const clientName = normText(r[IDX_CLIENT_NAME]);
    const clientCode = normCode(r[IDX_CLIENT_CODE]);
    const itemNo = normCode(r[IDX_ITEM_NO]);
    const itemName = normText(r[IDX_ITEM_NAME]);
    const price = parseFloat(String(r[IDX_GL_PRICE])) || 0;

    if (!clientCode || !itemNo || !clientName || !itemName) continue;

    if (!clientMap.has(clientCode)) clientMap.set(clientCode, clientName);
    if (!itemsMap.has(itemNo)) itemsMap.set(itemNo, itemName);

    const key = `${clientCode}:${itemNo}`;
    if (!clientItemsMap.has(key)) {
      clientItemsMap.set(key, { clientCode, itemNo, itemName, price });
    }
  }

  return { clientMap, itemsMap, clientItemsMap };
}

/* ─── 업로드 처리기들 ─── */

async function processClient(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const { clientMap, itemMap } = parseClientSheet(rows);

  if (clientMap.size === 0) throw new Error("거래처 데이터가 없습니다. 엑셀 형식을 확인하세요.");

  // 엑셀 유래 데이터만 삭제 (학습 데이터 보존)
  await supabase.from('client_item_stats').delete().not('client_code', 'is', null);
  await supabase.from('clients').delete().not('client_code', 'is', null);
  await supabase.from('client_alias').delete().gte('weight', 10);

  // Batch upsert clients
  const clientRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, client_name: name, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  // Batch upsert aliases
  const aliasRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  // Batch upsert items
  const itemRows = Array.from(itemMap.values()).map(v => ({
    client_code: v.client_code, item_no: v.item_no, item_name: v.item_name,
    supply_price: v.supply_price, buy_count: 0,
  }));
  for (let i = 0; i < itemRows.length; i += 500) {
    await supabase.from('client_item_stats').upsert(itemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: clientMap.size, items: itemMap.size };
}

async function processDlClient(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const { clientMap, itemsMap, clientItemsMap } = parseDlClientSheet(rows);

  if (clientMap.size === 0) throw new Error("거래처 데이터가 없습니다. 엑셀 형식을 확인하세요.");

  // FK 순서: 자식 테이블 먼저 삭제 (glass_client_item_stats → glass_client_alias → glass_items → glass_clients)
  await supabase.from('glass_client_item_stats').delete().not('client_code', 'is', null);
  await supabase.from('glass_client_alias').delete().gte('weight', 10);
  await supabase.from('glass_items').delete().not('item_no', 'is', null);
  await supabase.from('glass_clients').delete().not('client_code', 'is', null);

  // Batch upsert clients
  const clientRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, client_name: name,
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('glass_clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  // Batch upsert aliases
  const aliasRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('glass_client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  // Batch upsert items
  const itemRows = Array.from(itemsMap.entries()).map(([no, name]) => ({
    item_no: no, item_name: name, supply_price: 0, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < itemRows.length; i += 500) {
    await supabase.from('glass_items').upsert(itemRows.slice(i, i + 500), { onConflict: 'item_no' });
  }

  // Batch upsert client items
  const clientItemRows = Array.from(clientItemsMap.values()).map(item => ({
    client_code: item.clientCode, item_no: item.itemNo, item_name: item.itemName,
    supply_price: item.price, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientItemRows.length; i += 500) {
    await supabase.from('glass_client_item_stats').upsert(clientItemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: clientMap.size, items: itemsMap.size, clientItems: clientItemsMap.size };
}

async function processRiedel(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 헤더 행 찾기: "Code" 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = (rows[i] || []) as unknown[];
    if (r.some((c) => String(c).trim() === "Code")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("리델 헤더 행을 찾을 수 없습니다. 'Code' 컬럼이 필요합니다.");

  // 기존 riedel_items 삭제
  await supabase.from('riedel_items').delete().not('code', 'is', null);

  let count = 0;
  let lastSeries = "";

  const riedelRows: Array<{
    code: string; series: string; item_kr: string; item_en: string;
    unit: number | null; supply_price: number | null; box_price: number | null; note: string;
    updated_at: string;
  }> = [];

  const glassUpdates: Array<{ code: string; supply_price: number }> = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const code = normText(r[1]);
    if (!code) continue;

    const series = normText(r[0]) || lastSeries;
    if (normText(r[0])) lastSeries = normText(r[0]);

    const supplyPrice = toNumber(r[5]);

    riedelRows.push({
      code, series, item_kr: normText(r[2]), item_en: normText(r[3]),
      unit: toNumber(r[4]), supply_price: supplyPrice, box_price: toNumber(r[6]),
      note: normText(r[7]), updated_at: new Date().toISOString(),
    });

    // glass_items에 공급가 반영
    if (supplyPrice != null) {
      glassUpdates.push({ code, supply_price: supplyPrice });
    }

    count++;
  }

  // Batch insert riedel_items
  for (let i = 0; i < riedelRows.length; i += 500) {
    await supabase.from('riedel_items').insert(riedelRows.slice(i, i + 500));
  }

  // Update glass_items supply_price one by one (different codes)
  for (const u of glassUpdates) {
    await supabase.from('glass_items')
      .update({ supply_price: u.supply_price, updated_at: new Date().toISOString() })
      .eq('item_no', u.code);
  }

  return { items: count };
}

async function processDownloads(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // ★ wines 기준선 세팅 (기존 로직 유지)
  try {
    ensureWineTables();
    const { count: wineCount } = await supabase.from('wines').select('*', { count: 'exact', head: true });
    if ((wineCount ?? 0) === 0) {
      const { data: oldItems, error: oldError } = await supabase
        .from('inventory_cdv')
        .select('item_no, item_name, supply_price, available_stock, vintage, alcohol_content, country')
        .not('item_no', 'is', null)
        .neq('item_no', '');
      if (!oldError && oldItems && oldItems.length > 0) {
        const baselineRows = oldItems.map((item: { item_no: string; item_name: string; supply_price: number | null; available_stock: number | null; vintage: string | null; alcohol_content: string | null; country: string | null }) => {
          const { kr, en } = getCountryPair(item.country || '');
          return {
            item_code: item.item_no, item_name_kr: item.item_name,
            country: kr || item.country, country_en: en,
            vintage: item.vintage, alcohol: item.alcohol_content,
            supply_price: item.supply_price, available_stock: item.available_stock,
            status: 'active',
          };
        });
        for (let i = 0; i < baselineRows.length; i += 500) {
          await supabase.from('wines').upsert(baselineRows.slice(i, i + 500), {
            onConflict: 'item_code', ignoreDuplicates: true,
          });
        }
        logger.info(`[Downloads] Baseline: ${oldItems.length} wines from old inventory_cdv as 'active'`);
      }
    }
  } catch (e) {
    logger.warn("[Downloads] Baseline setup failed (non-fatal)", { error: e });
  }

  // 기존 inventory_cdv 삭제
  await supabase.from('inventory_cdv').delete().not('item_no', 'is', null);

  // 동적 헤더 기반 파싱
  const inventoryRows = parseInventorySheet(rows);

  // Batch upsert inventory_cdv
  for (let i = 0; i < inventoryRows.length; i += 500) {
    const { error } = await supabase.from('inventory_cdv').upsert(inventoryRows.slice(i, i + 500), { onConflict: 'item_no' });
    if (error) {
      logger.error(`[Downloads] inventory_cdv upsert error at batch ${i}`, { error });
      throw new Error(`inventory_cdv upsert failed: ${error.message}`);
    }
  }

  // CDV 재고금액 기록: (보세 + 용마로지스) * 공급가
  let cdvTotal = 0;
  for (const row of inventoryRows) {
    const supply = Number(row.supply_price) || 0;
    const bonded = Number(row.bonded_warehouse) || 0;
    const yongma = Number(row.yongma_logistics) || 0;
    cdvTotal += (bonded + yongma) * supply;
  }
  try {
    await recordInventoryValuePartial('cdv', cdvTotal);
    logger.info(`[Downloads] Recorded CDV inventory value: ${cdvTotal}`);
  } catch (e) {
    logger.warn("[Downloads] Failed to record inventory value (non-fatal)", { error: e });
  }

  return { items: inventoryRows.length };
}

async function processDl(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 기존 inventory_dl 삭제
  await supabase.from('inventory_dl').delete().not('item_no', 'is', null);

  // 동적 헤더 기반 파싱
  const dlRows = parseInventorySheet(rows);

  // Batch upsert inventory_dl
  for (let i = 0; i < dlRows.length; i += 500) {
    await supabase.from('inventory_dl').upsert(dlRows.slice(i, i + 500), { onConflict: 'item_no' });
  }

  // DL 재고금액 기록: (안성 + GIG + GIG마케팅 + GIG영업1) * 공급가
  let dlTotal = 0;
  for (const row of dlRows) {
    const supply = Number(row.supply_price) || 0;
    const anseong = Number(row.anseong_warehouse) || 0;
    const gig = Number(row.gig_warehouse) || 0;
    const gigMkt = Number(row.gig_marketing) || 0;
    const gigSales = Number(row.gig_sales1) || 0;
    dlTotal += (anseong + gig + gigMkt + gigSales) * supply;
  }
  try {
    await recordInventoryValuePartial('dl', dlTotal);
    logger.info(`[DL] Recorded DL inventory value: ${dlTotal}`);
  } catch (e) {
    logger.warn("[DL] Failed to record inventory value (non-fatal)", { error: e });
  }

  return { items: dlRows.length };
}

async function processEnglish(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 헤더 행 찾기: 국가(country) 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = (rows[i] || []) as unknown[];
    if (r.some((c) => String(c).includes("country") || String(c).includes("국가"))) {
      headerIdx = i;
      break;
    }
  }
  // 데이터 시작: 헤더 + 서브헤더(영문/한글) 건너뛰기
  const dataStart = headerIdx >= 0 ? headerIdx + 2 : 4;

  // Data columns (0-based):
  // 0=seq, 1=item_no, 2=?, 3=country, 4=supplier, 5=region, 6=image,
  // 7=wine_name_en, 8=wine_name_kr, 9=vintage, 10=ml, 11=supply_price,
  // 12=supplier_name, 13=stock, 14=bonded

  // 기존 wine_list_english 삭제
  await supabase.from('wine_list_english').delete().not('item_no', 'is', null);

  const englishRows: Array<{
    item_no: string; country: string; supplier: string; region: string;
    wine_name_en: string; wine_name_kr: string; vintage: string;
    ml: number | null; supply_price: number | null; supplier_name: string;
    stock: number | null; bonded: number | null; updated_at: string;
  }> = [];

  let count = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const item_no = normCode(r[1]);
    if (!item_no) continue;

    englishRows.push({
      item_no,
      country: normText(r[3]),
      supplier: normText(r[4]),
      region: normText(r[5]),
      wine_name_en: normText(r[7]),
      wine_name_kr: normText(r[8]),
      vintage: normText(r[9]),
      ml: toNumber(r[10]),
      supply_price: toNumber(r[11]),
      supplier_name: normText(r[12]),
      stock: toNumber(r[13]),
      bonded: toNumber(r[14]),
      updated_at: new Date().toISOString(),
    });
    count++;
  }

  // Batch insert wine_list_english
  for (let i = 0; i < englishRows.length; i += 500) {
    await supabase.from('wine_list_english').insert(englishRows.slice(i, i + 500));
  }

  return { items: count };
}

/* ─── 클라이언트 사이드 파싱 데이터 처리 (대용량 파일 대응) ─── */

export async function processClientFromData(
  clients: Record<string, string>,
  items: Array<{ client_code: string; item_no: string; item_name: string; supply_price: number | null }>
) {
  if (Object.keys(clients).length === 0) throw new Error("거래처 데이터가 없습니다.");

  await supabase.from('client_item_stats').delete().not('client_code', 'is', null);
  await supabase.from('clients').delete().not('client_code', 'is', null);
  await supabase.from('client_alias').delete().gte('weight', 10);

  const clientRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, client_name: name, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  const aliasRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  const itemRows = items.map(v => ({
    client_code: v.client_code, item_no: v.item_no, item_name: v.item_name,
    supply_price: v.supply_price, buy_count: 0,
  }));
  for (let i = 0; i < itemRows.length; i += 500) {
    await supabase.from('client_item_stats').upsert(itemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: Object.keys(clients).length, items: items.length };
}

export async function processDlClientFromData(
  clients: Record<string, string>,
  items: Array<{ client_code: string; item_no: string; item_name: string; supply_price: number }>
) {
  if (Object.keys(clients).length === 0) throw new Error("거래처 데이터가 없습니다.");

  await supabase.from('glass_client_item_stats').delete().not('client_code', 'is', null);
  await supabase.from('glass_client_alias').delete().gte('weight', 10);
  await supabase.from('glass_items').delete().not('item_no', 'is', null);
  await supabase.from('glass_clients').delete().not('client_code', 'is', null);

  const clientRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, client_name: name,
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('glass_clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  const aliasRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('glass_client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  // Unique items
  const itemsMap = new Map<string, string>();
  for (const item of items) {
    if (!itemsMap.has(item.item_no)) itemsMap.set(item.item_no, item.item_name);
  }
  const glassItemRows = Array.from(itemsMap.entries()).map(([no, name]) => ({
    item_no: no, item_name: name, supply_price: 0, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < glassItemRows.length; i += 500) {
    await supabase.from('glass_items').upsert(glassItemRows.slice(i, i + 500), { onConflict: 'item_no' });
  }

  const clientItemRows = items.map(item => ({
    client_code: item.client_code, item_no: item.item_no, item_name: item.item_name,
    supply_price: item.supply_price, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientItemRows.length; i += 500) {
    await supabase.from('glass_client_item_stats').upsert(clientItemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: Object.keys(clients).length, items: itemsMap.size, clientItems: items.length };
}

/* ─── Shipment 트랜잭션 데이터 처리 (배치 업로드) ─── */

export interface ShipmentRow {
  client_name: string;
  client_code: string;
  ship_date: string | null;
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number | null;
  selling_price: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  business_type: string;
  manager: string;
  department: string;
  warehouse: string;
  shipment_no?: string;
  order_type?: string;
  sales_type?: string;
}

export async function processShipmentsFromData(
  shipments: ShipmentRow[],
  table: 'shipments' | 'glass_shipments',
  clear: boolean
) {
  if (clear) {
    await supabase.from(table).delete().not('id', 'is', null);
    logger.info(`[Shipments] Cleared ${table}`);
  }

  let inserted = 0;
  for (let i = 0; i < shipments.length; i += 500) {
    const batch = shipments.slice(i, i + 500);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      logger.error(`[Shipments] ${table} insert error at batch ${i}`, { error });
      throw new Error(`${table} insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[Shipments] Inserted ${inserted} rows into ${table}`);
  return { inserted };
}

/* ─── 메인 처리 함수 ─── */
export async function processUpload(type: UploadType, fileBuffer: Buffer) {
  logger.info(`Admin upload: processing type=${type}, size=${fileBuffer.length}`);

  // 업로드 파일을 /tmp에 저장 (동기화 시 최신 파일 사용 가능)
  saveUploadedFile(type, fileBuffer);

  switch (type) {
    case "client":
      return await processClient(fileBuffer);
    case "dl-client":
      return await processDlClient(fileBuffer);
    case "riedel":
      return await processRiedel(fileBuffer);
    case "downloads":
      return await processDownloads(fileBuffer);
    case "dl":
      return await processDl(fileBuffer);
    case "english":
      return await processEnglish(fileBuffer);
    default:
      throw new Error(`지원하지 않는 업로드 타입: ${type}`);
  }
}
