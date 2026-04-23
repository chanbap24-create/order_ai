import type { DocSettings, QuoteColumnKey, WarehouseTab } from "../../types";

type ExportParams = {
  tab: WarehouseTab;
  manager: string;
  clientName: string;
  visibleColumns: QuoteColumnKey[];
  docSettings: DocSettings;
};

/** 견적 엑셀 다운로드 */
export async function exportQuoteExcel(p: ExportParams): Promise<Blob> {
  const res = await fetch("/api/quote/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error("엑셀 다운로드에 실패했습니다.");
  return res.blob();
}

/** 테이스팅 노트 합본 PDF/PPTX 다운로드 */
export async function exportTastingNotes(
  format: "pdf" | "pptx",
  p: { tab: WarehouseTab; manager: string; clientName: string },
): Promise<Blob> {
  const path =
    format === "pdf" ? "/api/quote/tasting-notes-pdf" : "/api/quote/tasting-notes-pptx";
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error("다운로드 중 오류가 발생했습니다.");
  return res.blob();
}

/** Blob을 다운로드 트리거 (브라우저 기본 다운로드) */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 날짜 접미사 (YYYYMMDD) */
export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
