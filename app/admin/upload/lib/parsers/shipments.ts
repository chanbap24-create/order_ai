export type ShipmentRow = {
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
};

export type ParsedShipments = {
  clients: Record<string, string>;
  items: Array<{
    client_code: string;
    item_no: string;
    item_name: string;
    supply_price: number | null;
  }>;
  shipments: ShipmentRow[];
  header: string[];
  indices: {
    IDX_CLIENT_NAME: number;
    IDX_CLIENT_CODE: number;
    IDX_SHIP_DATE: number;
    IDX_ITEM_NO: number;
    IDX_ITEM_NAME: number;
    IDX_QUANTITY: number;
    IDX_MANAGER: number;
  };
};

export type ShipmentParseError =
  | { kind: "inventory_file" }
  | { kind: "not_shipment"; detected: string[] };

/**
 * 출고현황 엑셀 파싱 (client/dl-client 공용).
 * 헤더 기반 동적 컬럼 매핑으로 엑셀 형식 변경에 대응.
 */
export async function parseShipmentsFile(
  file: File,
  type: "client" | "dl-client",
): Promise<ParsedShipments | ShipmentParseError> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  const headerCheck = (rows[0] as unknown[]).map((v) => String(v ?? "").trim());
  const headerJoined = headerCheck.join("|");
  if (headerJoined.includes("재고수량") || headerJoined.includes("가용재고")) {
    return { kind: "inventory_file" };
  }
  if (!headerJoined.includes("판매처") && !headerJoined.includes("출고일")) {
    return { kind: "not_shipment", detected: headerCheck.filter(Boolean).slice(0, 10) };
  }

  const header = headerCheck;
  const col = (name: string): number => {
    const exact = header.findIndex((h) => h === name);
    if (exact >= 0) return exact;
    return header.findIndex((h) => h.startsWith(name));
  };
  const IDX_CLIENT_NAME =
    col("판매처") >= 0 && col("판매처") !== col("판매처번호") ? col("판매처") : 4;
  const IDX_CLIENT_CODE = col("판매처번호") >= 0 ? col("판매처번호") : 5;
  const IDX_SHIP_DATE = col("출고일") >= 0 ? col("출고일") : 6;
  const IDX_BIZ_TYPE = col("업종구분") >= 0 ? col("업종구분") : 7;
  const IDX_ITEM_NO = col("품번") >= 0 ? col("품번") : 12;
  const IDX_ITEM_NAME = col("품명") >= 0 ? col("품명") : 13;
  const IDX_SELLING_PRICE = col("판매단가") >= 0 ? col("판매단가") : 16;
  const IDX_QUANTITY = col("출고수량") >= 0 ? col("출고수량") : 18;
  const IDX_UNIT_PRICE = col("기준단가") >= 0 ? col("기준단가") : 19;
  const IDX_SUPPLY_AMT = col("공급가액") >= 0 ? col("공급가액") : 20;
  const IDX_TAX_AMT = col("세액") >= 0 ? col("세액") : 21;
  const IDX_TOTAL_AMT = col("합계금액") >= 0 ? col("합계금액") : 22;
  const IDX_WAREHOUSE = col("창고") >= 0 ? col("창고") : 23;
  const IDX_MANAGER = col("담당자") >= 0 ? col("담당자") : 37;
  const IDX_DEPARTMENT = col("부서") >= 0 ? col("부서") : 38;
  const IDX_PRICE = type === "client" ? IDX_UNIT_PRICE : IDX_SELLING_PRICE;

  const toNum = (v: unknown): number | null => {
    const n = parseFloat(String(v));
    return isFinite(n) ? n : null;
  };
  const toStr = (v: unknown): string => String(v ?? "").trim();
  const toCode = (v: unknown): string => String(v ?? "").trim().replace(/\.0$/, "");
  const toDate = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "number") {
      const d = new Date((v - 25569) * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return s.replace(/\//g, "-");
    return null;
  };

  const clients: Record<string, string> = {};
  const items: ParsedShipments["items"] = [];
  const seen = new Set<string>();
  const shipments: ShipmentRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const clientName = toStr(r[IDX_CLIENT_NAME]);
    const clientCode = toCode(r[IDX_CLIENT_CODE]);
    if (!clientName || !clientCode) continue;
    clients[clientCode] = clientName;

    const itemNo = toCode(r[IDX_ITEM_NO]);
    const itemName = toStr(r[IDX_ITEM_NAME]);
    if (!itemNo || !itemName) continue;

    const key = `${clientCode}||${itemNo}`;
    if (!seen.has(key)) {
      seen.add(key);
      const p = parseFloat(String(r[IDX_PRICE]));
      items.push({
        client_code: clientCode,
        item_no: itemNo,
        item_name: itemName,
        supply_price: isFinite(p) ? p : null,
      });
    }

    shipments.push({
      client_name: clientName,
      client_code: clientCode,
      ship_date: toDate(r[IDX_SHIP_DATE]),
      item_no: itemNo,
      item_name: itemName,
      quantity: Math.round(toNum(r[IDX_QUANTITY]) ?? 0),
      unit_price: toNum(r[IDX_UNIT_PRICE]),
      selling_price: toNum(r[IDX_SELLING_PRICE]),
      supply_amount: toNum(r[IDX_SUPPLY_AMT]),
      tax_amount: toNum(r[IDX_TAX_AMT]),
      total_amount: toNum(r[IDX_TOTAL_AMT]),
      business_type: toStr(r[IDX_BIZ_TYPE]),
      manager: toStr(r[IDX_MANAGER]),
      department: toStr(r[IDX_DEPARTMENT]),
      warehouse: toStr(r[IDX_WAREHOUSE]),
    });
  }

  return {
    clients,
    items,
    shipments,
    header,
    indices: {
      IDX_CLIENT_NAME,
      IDX_CLIENT_CODE,
      IDX_SHIP_DATE,
      IDX_ITEM_NO,
      IDX_ITEM_NAME,
      IDX_QUANTITY,
      IDX_MANAGER,
    },
  };
}
