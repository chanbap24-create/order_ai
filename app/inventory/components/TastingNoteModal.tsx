"use client";

import { TastingNoteDbCard } from "./TastingNoteDbCard";
import { PdfCanvasViewer } from "@/app/components/PdfCanvasViewer";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedItemNo: string;
  selectedWineName: string;
  loading: boolean;
  source: "pdf" | "db" | "";
  pdfUrl: string;
  originalPdfUrl: string;
  dbTastingNote: any;
  dbWineInfo: any;
  onDownload: (url: string, filename: string) => void;
};

/**
 * 테이스팅 노트 모달 — 3분기:
 * - loading: 로딩 인디케이터
 * - source === 'db': DB 저장 노트를 카드로 렌더
 * - source === 'pdf': 원본 PDF를 iframe으로 렌더
 */
const isMobile = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

export function TastingNoteModal({
  open,
  onClose,
  selectedItemNo,
  selectedWineName,
  loading,
  source,
  pdfUrl,
  originalPdfUrl,
  dbTastingNote,
  dbWineInfo,
  onDownload,
}: Props) {
  if (!open) return null;
  const mobile = isMobile();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: mobile ? 0 : 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          // 모바일은 풀스크린 시트 — 띄운 카드 대신 화면 전체
          borderRadius: mobile ? 0 : 12,
          width: mobile ? "100vw" : "95vw",
          maxWidth: mobile ? undefined : "1400px",
          height: mobile ? "100dvh" : "95vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          paddingTop: mobile ? "env(safe-area-inset-top)" : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface)",
            color: "var(--text-primary)",
          }}
        >
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 600 }}>테이스팅 노트</div>
            <div
              style={{
                fontSize: "0.78rem",
                marginTop: 4,
                color: "var(--text-tertiary)",
              }}
            >
              {selectedItemNo} - {selectedWineName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              fontSize: 20,
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <Placeholder icon="..." text="테이스팅 노트를 불러오는 중..." />
          ) : source === "db" && dbTastingNote ? (
            <TastingNoteDbCard
              selectedItemNo={selectedItemNo}
              selectedWineName={selectedWineName}
              dbTastingNote={dbTastingNote}
              dbWineInfo={dbWineInfo}
              originalPdfUrl={originalPdfUrl}
              onDownload={onDownload}
            />
          ) : source === "pdf" && pdfUrl ? (
            <PdfFrame
              pdfUrl={pdfUrl}
              originalPdfUrl={originalPdfUrl}
              itemNo={selectedItemNo}
              onDownload={onDownload}
            />
          ) : (
            <Placeholder icon="-" text="테이스팅 노트를 찾을 수 없습니다." />
          )}
        </div>
      </div>
    </div>
  );
}

function Placeholder({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: "center", color: "var(--neutral-100)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{icon}</div>
      <div>{text}</div>
    </div>
  );
}

function PdfFrame({
  pdfUrl,
  originalPdfUrl,
  itemNo,
  onDownload,
}: {
  pdfUrl: string;
  originalPdfUrl: string;
  itemNo: string;
  onDownload: (url: string, filename: string) => void;
}) {
  // 전 기기 pdf.js로 원본을 직접 그린다 — 안드로이드는 내장 뷰어가 없어 다운로드로 빠지고,
  // PC는 브라우저 뷰어의 어두운 프레임이 붙는다. 문서만 깔끔하게 같은 화면으로.
  const btn = { padding: "5px 12px", borderRadius: 999, border: "1px solid var(--border-default)", background: "transparent", fontSize: 12, cursor: "pointer" } as const;
  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0 }}>
      <PdfCanvasViewer url={pdfUrl} actions={<>
        <button onClick={() => onDownload(originalPdfUrl, `${itemNo}.pdf`)} style={btn}>PDF 저장</button>
        <button onClick={() => onDownload(originalPdfUrl.replace(".pdf", ".pptx"), `${itemNo}.pptx`)} style={btn}>PPTX 저장</button>
      </>} />
    </div>
  );
}
