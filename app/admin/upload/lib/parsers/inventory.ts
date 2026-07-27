/**
 * 재고현황 파싱 (downloads/dl 공용) — 브라우저에서 실행.
 * 실제 파싱은 서버와 동일한 parseInventorySheet에 위임(단일 소스):
 * 매장(백화점) 재고 차감·수입사 추출·extra_data 보존이 업로드 경로와 무관하게 항상 적용된다.
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

  const { parseInventorySheet } = await import("@/app/lib/admin-upload/parseInventory");
  const out = parseInventorySheet(rawRows);

  if (out.length === 0) {
    throw new Error("파싱된 재고 데이터가 0건입니다. 파일을 확인해주세요.");
  }
  return out;
}
