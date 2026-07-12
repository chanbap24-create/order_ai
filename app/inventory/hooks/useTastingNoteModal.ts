import { useCallback, useEffect, useState } from "react";
import { shareOrDownloadFile } from "@/app/lib/shareFile";

type Source = "pdf" | "db" | "";

/**
 * 테이스팅 노트 모달 + 인덱스 + 항목별 사용 가능 여부 맵.
 * - fetchIndex: 마운트 시 전체 인덱스 로드 → tastingNoteSet 갱신
 * - markAvailable: 검색 결과에서 품번별로 있음 여부 체크한 뒤 UI 강조용 맵 갱신
 */
export function useTastingNoteModal() {
  const [showTastingNote, setShowTastingNote] = useState(false);
  const [tastingNoteUrl, setTastingNoteUrl] = useState("");
  const [originalPdfUrl, setOriginalPdfUrl] = useState("");
  const [tastingNoteLoading, setTastingNoteLoading] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState("");
  const [selectedWineName, setSelectedWineName] = useState("");
  const [tastingNoteSource, setTastingNoteSource] = useState<Source>("");
  const [dbTastingNote, setDbTastingNote] = useState<any>(null);
  const [dbWineInfo, setDbWineInfo] = useState<any>(null);
  const [tastingNotesAvailable, setTastingNotesAvailable] = useState<
    Record<string, boolean>
  >({});
  const [tastingNoteSet, setTastingNoteSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        // 인덱스 사전 로드 — 사용자 액션 아니므로 추적 제외
        const r = await fetch("/api/tasting-notes", { headers: { 'X-Track-Skip': '1' } });
        const data = await r.json();
        if (data.success && data.notes) {
          const s = new Set<string>();
          for (const [k, v] of Object.entries(data.notes as Record<string, any>)) {
            if ((v as any)?.exists) s.add(k);
          }
          setTastingNoteSet(s);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const openFor = useCallback(async (itemNo: string, itemName: string) => {
    setSelectedItemNo(itemNo);
    setSelectedWineName(itemName);
    setTastingNoteLoading(true);
    setShowTastingNote(true);
    setTastingNoteSource("");
    setDbTastingNote(null);
    setDbWineInfo(null);
    setTastingNoteUrl("");
    setOriginalPdfUrl("");
    try {
      const response = await fetch(`/api/tasting-notes?item_no=${itemNo}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || "테이스팅 노트를 찾을 수 없습니다.");
        setShowTastingNote(false);
        return;
      }
      if (data.source === "db") {
        setTastingNoteSource("db");
        setDbTastingNote(data.tasting_note);
        setDbWineInfo(data.wine_info || null);
        if (data.pdf_url) setOriginalPdfUrl(data.pdf_url);
      } else {
        setTastingNoteSource("pdf");
        setTastingNoteUrl(`/api/proxy/pdf?url=${encodeURIComponent(data.pdf_url)}`);
        setOriginalPdfUrl(data.pdf_url);
      }
    } catch {
      alert("테이스팅 노트를 불러오는 중 오류가 발생했습니다.");
      setShowTastingNote(false);
    } finally {
      setTastingNoteLoading(false);
    }
  }, []);

  const close = useCallback(() => setShowTastingNote(false), []);

  /** 특정 품번의 테이스팅 노트 존재 여부를 맵에 반영 */
  const markAvailable = useCallback((itemNo: string) => {
    setTastingNotesAvailable((prev) => ({ ...prev, [itemNo]: true }));
  }, []);

  /** 외부 PDF URL을 프록시 경유로 받기 — 모바일은 파일만 공유 시트(카톡에 URL 안 딸려감), 데스크탑은 다운로드 */
  const download = useCallback(async (url: string, filename: string) => {
    try {
      const downloadUrl = `/api/proxy/pdf?url=${encodeURIComponent(url)}&download=true`;
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      await shareOrDownloadFile(blob, filename, "application/pdf");
    } catch {
      alert("다운로드 중 오류가 발생했습니다.");
    }
  }, []);

  return {
    // modal state
    showTastingNote,
    close,
    openFor,
    tastingNoteUrl,
    originalPdfUrl,
    tastingNoteLoading,
    selectedItemNo,
    selectedWineName,
    tastingNoteSource,
    dbTastingNote,
    dbWineInfo,
    // indexes
    tastingNotesAvailable,
    tastingNoteSet,
    markAvailable,
    // utility
    download,
  };
}
