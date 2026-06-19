import { useCallback, useState } from "react";
import type { DocSettings, QuoteColumnKey, QuoteItem, WarehouseTab } from "../types";

type Params = {
  clientName: string;
  clientCode?: string | null;
  activeTab: WarehouseTab;
  visibleQuoteColumns: QuoteColumnKey[];
  docSettings: DocSettings;
  getManagerParam: () => string;
  /** 자동 저장(견적 이력)용 현재 견적 항목 */
  quoteItems?: QuoteItem[];
  /** 편집 중인 셀이 있으면 먼저 저장 완료 후 export */
  flushPendingEdit?: () => Promise<void> | void;
  /** 저장 견적 목록 갱신 트리거(자동저장 직후) */
  onSaved?: () => void;
};

/** 오늘 날짜 YYYYMMDD */
function todayStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/** Blob을 파일 다운로드 트리거 */
function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Excel 견적서 + 테이스팅 노트 합본(PDF/PPTX) 다운로드 핸들러.
 * 편집 중인 셀이 있으면 commit 후 export하도록 flushPendingEdit을 받는다.
 */
export function useQuoteExports(p: Params) {
  const [exporting, setExporting] = useState(false);
  const [exportingNotes, setExportingNotes] = useState(false);
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);

  const handleExport = useCallback(async () => {
    if (p.flushPendingEdit) {
      await p.flushPendingEdit();
    }
    setExporting(true);
    try {
      const columnsParam = encodeURIComponent(JSON.stringify(p.visibleQuoteColumns));
      const settingsParam = encodeURIComponent(JSON.stringify(p.docSettings));
      const mgr = p.getManagerParam();
      const url =
        `/api/quote/export?client_name=${encodeURIComponent(p.clientName)}` +
        `&columns=${columnsParam}&doc_settings=${settingsParam}&company=${p.activeTab}` +
        (mgr ? `&manager=${encodeURIComponent(mgr)}` : "");

      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      triggerDownload(blob, `견적서_${todayStamp()}_${p.clientName || "미지정"}.xlsx`);

      // 내보낼 때 자동으로 견적 이력 저장(담당·거래처별). 빈 견적은 저장 안 함.
      if (p.quoteItems && p.quoteItems.length > 0) {
        try {
          await fetch("/api/quote/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              manager: mgr,
              client_code: p.clientCode || null,
              client_name: p.clientName || "",
              company: p.activeTab,
              items: p.quoteItems,
              doc_settings: p.docSettings,
              columns: p.visibleQuoteColumns,
            }),
          });
          p.onSaved?.();
        } catch (saveErr) {
          console.error("견적 이력 자동 저장 실패(내보내기는 성공):", saveErr);
        }
      }
    } catch (e) {
      console.error("Export failed:", e);
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }, [p]);

  const handleTastingNotesDownload = useCallback(
    async (format: "pdf" | "pptx") => {
      setExportingNotes(true);
      try {
        const mgr = p.getManagerParam();
        const endpoint =
          format === "pptx"
            ? "/api/quote/tasting-notes-pptx"
            : "/api/quote/tasting-notes-pdf";
        const url =
          `${endpoint}?client_name=${encodeURIComponent(p.clientName)}` +
          (mgr ? `&manager=${encodeURIComponent(mgr)}` : "");

        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "다운로드 실패" }));
          alert(err.error || "다운로드 실패");
          return;
        }
        const blob = await res.blob();
        triggerDownload(
          blob,
          `테이스팅노트_${todayStamp()}_${p.clientName || "미지정"}.${format}`,
        );
      } catch (e) {
        console.error(`Tasting notes ${format} failed:`, e);
        alert("테이스팅 노트 다운로드에 실패했습니다.");
      } finally {
        setExportingNotes(false);
      }
    },
    [p],
  );

  return {
    exporting,
    exportingNotes,
    noteMenuOpen,
    setNoteMenuOpen,
    handleExport,
    handleTastingNotesDownload,
  };
}
