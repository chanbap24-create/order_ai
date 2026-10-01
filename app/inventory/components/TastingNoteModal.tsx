"use client";

import { TastingNoteDbCard } from "./TastingNoteDbCard";

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
  // 모바일(iOS Safari)은 PDF iframe이 첫 페이지만 렌더/스크롤 불가 —
  // 새 탭 네이티브 뷰어(핀치줌 지원)로 연다
  if (isMobile()) {
    return (
      <div style={{ width: "100%", textAlign: "center", padding: "32px 0" }}>
        <button
          onClick={() => window.open(pdfUrl, "_blank")}
          style={{
            padding: "14px 28px", borderRadius: 11, border: "none",
            background: "var(--action)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}
        >
          PDF 전체 화면으로 보기
        </button>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 8 }}>
          <button onClick={() => onDownload(originalPdfUrl, `${itemNo}.pdf`)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", fontSize: "0.8rem", cursor: "pointer" }}>
            PDF 저장
          </button>
          <button onClick={() => onDownload(originalPdfUrl.replace(".pdf", ".pptx"), `${itemNo}.pptx`)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", fontSize: "0.8rem", cursor: "pointer" }}>
            PPTX 저장
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={() => onDownload(originalPdfUrl, `${itemNo}.pdf`)}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--action)",
            color: "white",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          PDF
        </button>
        <button
          onClick={() =>
            onDownload(originalPdfUrl.replace(".pdf", ".pptx"), `${itemNo}.pptx`)
          }
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--surface-dark)",
            color: "white",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          PPTX
        </button>
      </div>
      <div
        style={{
          flex: 1,
          background: "var(--gray-100)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border-default)",
          position: "relative",
        }}
      >
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
          title="테이스팅 노트 PDF"
          width="100%"
          height="100%"
          style={{ border: "none" }}
        />
      </div>
    </div>
  );
}
