export type ImportScheduleItemParsed = {
  item_code: string;
  item_name_kr: string;
  item_name_en: string;
  brand_code: string;
  vintage: string;
  total_btls: number;
  bl_number: string;
  arrival_date: string;
};

/** 엑셀 셀 → 'YYYY-MM-DD' (숫자 시리얼·문자열 모두) */
function toDateStr(v: unknown): string {
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400000);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(v || "").trim().replace(/\./g, "-").replace(/\//g, "-");
  return /^\d{4}-\d{1,2}-\d{1,2}/.test(s)
    ? s.split("-").map((x, i) => (i === 0 ? x : x.padStart(2, "0"))).join("-").slice(0, 10)
    : "";
}

/** 품번 3~4자리 → 빈티지 표기(전사 규칙 extractVintage와 동일) */
function vintageOf(code: string): string {
  if (!code || code.length < 4) return "";
  const v = code.slice(2, 4).toUpperCase();
  if (v === "NV" || v === "MV") return v;
  if (!/^\d{2}$/.test(v)) return "";
  return Number(v) >= 50 ? `19${v}` : `20${v}`;
}

/**
 * 미착 리스트 양식 파싱(헤더 기반) — 마케팅부 SharePoint 'CDV 미착 리스트' 등.
 * 헤더 행에서 입항일/품번/품명/수량/와이너리 컬럼 위치를 찾아 매핑.
 * 해당 헤더가 없으면 null(레거시 위치 기반 양식으로 폴백).
 */
function parseByHeaders(rows: unknown[][]): ImportScheduleItemParsed[] | null {
  let headerIdx = -1;
  let col: Record<string, number> = {};
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const cells = (rows[i] || []).map((c) => String(c || "").replace(/\s/g, ""));
    const find = (kw: string[]) => cells.findIndex((h) => kw.some((k) => h.includes(k)));
    const c = {
      arrival: find(["입항일", "입고예정", "입고일"]),
      code: find(["품번"]),
      name: find(["품명"]),
      qty: find(["수량"]),
      brand: find(["와이너리", "브랜드"]),
    };
    if (c.arrival >= 0 && c.code >= 0 && c.name >= 0) { headerIdx = i; col = c; break; }
  }
  if (headerIdx < 0) return null;

  const items: ImportScheduleItemParsed[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const itemCode = String(r[col.code] || "").trim();
    const arrivalDate = toDateStr(r[col.arrival]);
    if (!itemCode || !arrivalDate) continue;
    const nameKr = String(r[col.name] || "").trim();
    const brandRaw = col.brand >= 0 ? String(r[col.brand] || "").trim() : "";
    const brandMatch = nameKr.match(/^([A-Za-z]+)\s/);
    items.push({
      item_code: itemCode,
      item_name_kr: nameKr,
      item_name_en: "",
      brand_code: (brandRaw || (brandMatch ? brandMatch[1] : "")).toUpperCase(),
      vintage: vintageOf(itemCode),
      total_btls: parseInt(String(r[col.qty >= 0 ? col.qty : -1] || "0").replace(/[,\s]/g, ""), 10) || 0,
      bl_number: "",
      arrival_date: arrivalDate,
    });
  }
  return items.length ? items : null;
}

/**
 * 수입일정 엑셀 파싱.
 * 1) 헤더 기반(미착 리스트: 입항일/와이너리/품번/품명/수량) 우선
 * 2) 레거시 위치 기반: J열(index 9)=arrival_date, A=item_code, B=국문명, C=영문명
 */
export async function parseImportScheduleFile(file: File): Promise<ImportScheduleItemParsed[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // ① 미착 리스트(헤더 기반) 양식
  const byHeaders = parseByHeaders(rows as unknown[][]);
  if (byHeaders) return byHeaders;

  // ② 레거시 위치 기반 — 데이터 시작 행 자동 감지
  let startRow = 2;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i] as unknown[];
    const j = r[9];
    if (j && String(r[0] || "").trim() && (typeof j === "number" || /^\d{4}[./]/.test(String(j)))) {
      startRow = i;
      break;
    }
  }

  const items: ImportScheduleItemParsed[] = [];
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const itemCode = String(r[0] || "").trim();
    const nameKr = String(r[1] || "").trim();
    const nameEn = String(r[2] || "").trim();
    const arrivalRaw = r[9];
    if (!itemCode || !arrivalRaw) continue;

    const brandMatch = nameKr.match(/^([A-Za-z]+)\s/);
    const brandCode = brandMatch ? brandMatch[1].toUpperCase() : "";

    let arrivalDate = "";
    if (typeof arrivalRaw === "number") {
      const d = new Date((arrivalRaw - 25569) * 86400000);
      if (!isNaN(d.getTime())) arrivalDate = d.toISOString().slice(0, 10);
    } else {
      arrivalDate = String(arrivalRaw).trim().replace(/\./g, "-");
    }
    if (!arrivalDate) continue;

    items.push({
      item_code: itemCode,
      item_name_kr: nameKr,
      item_name_en: nameEn,
      brand_code: brandCode,
      vintage: String(r[3] || "").trim(),
      total_btls: parseInt(String(r[6] || "0"), 10) || 0,
      bl_number: String(r[8] || "").trim(),
      arrival_date: arrivalDate,
    });
  }

  return items;
}
