/**
 * 재고현황 파싱 (downloads/dl 공용).
 * HEADER_MAP 기반 컬럼 매핑 + TEXT_COLUMNS 분기.
 */
export async function parseInventoryFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  const headers = (rawRows[0] as unknown[]).map((v) => String(v ?? "").trim());
  if (!headers.includes("품번") || !headers.includes("품명")) {
    throw new Error('재고현황 파일이 아닙니다. 헤더에 "품번", "품명"이 필요합니다.');
  }

  const { HEADER_MAP, TEXT_COLUMNS } = await import("@/app/lib/inventoryHeaders");
  const colMap: Array<{ idx: number; dbCol: string }> = [];
  for (let idx = 0; idx < headers.length; idx++) {
    const h = headers[idx];
    if (!h) continue;
    const dbCol = HEADER_MAP[h];
    if (dbCol) colMap.push({ idx, dbCol });
  }

  const normCode = (x: unknown) => String(x ?? "").trim().replace(/\.0$/, "");
  const normText = (x: unknown) => String(x ?? "").trim();
  const toNumber = (x: unknown): number | null => {
    if (x == null) return null;
    const s = String(x).replace(/,/g, "").trim();
    if (!s || s === "-") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const out: Record<string, unknown>[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i] as unknown[];
    const obj: Record<string, unknown> = {};
    for (const cm of colMap) {
      const raw = r[cm.idx];
      if (TEXT_COLUMNS.has(cm.dbCol)) {
        obj[cm.dbCol] = cm.dbCol === "item_no" ? normCode(raw) : normText(raw);
      } else {
        obj[cm.dbCol] = toNumber(raw);
      }
    }
    if (!obj.item_no) continue;
    obj.updated_at = new Date().toISOString();
    out.push(obj);
  }

  if (out.length === 0) {
    throw new Error("파싱된 재고 데이터가 0건입니다. 파일을 확인해주세요.");
  }

  return out;
}
