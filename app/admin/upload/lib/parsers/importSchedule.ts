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

/**
 * 수입일정 엑셀 파싱.
 * - J열(index 9) = arrival_date
 * - A열(index 0) = item_code, B열 = item_name_kr, C열 = item_name_en
 * - brand_code = nameKr 첫 공백 이전 알파벳
 */
export async function parseImportScheduleFile(file: File): Promise<ImportScheduleItemParsed[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 데이터 시작 행 자동 감지
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
