/** 테이스팅 노트 인덱스: { item_no: true } 맵 */
export async function fetchTastingNoteIndex(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch("/api/tasting-notes");
    const json = await res.json();
    return json.available || {};
  } catch {
    return {};
  }
}

export type TastingNoteDetail = {
  source: "pdf" | "db" | "";
  pdfUrl?: string;
  originalPdfUrl?: string;
  dbTastingNote?: any;
  dbWineInfo?: any;
};

/** 단일 품번 테이스팅 노트 상세 */
export async function fetchTastingNoteDetail(itemNo: string): Promise<TastingNoteDetail> {
  const res = await fetch(
    `/api/tasting-notes?item_no=${encodeURIComponent(itemNo)}`,
  );
  if (!res.ok) return { source: "" };
  const json = await res.json();
  return {
    source: json.source || "",
    pdfUrl: json.pdf_url,
    originalPdfUrl: json.original_pdf_url,
    dbTastingNote: json.tasting_note,
    dbWineInfo: json.wine_info,
  };
}
