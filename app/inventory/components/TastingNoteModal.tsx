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
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          width: "95vw",
          maxWidth: "1400px",
          height: "95vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(240,236,230,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#1a1a2e",
            color: "#f0ece6",
          }}
        >
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 600 }}>테이스팅 노트</div>
            <div
              style={{
                fontSize: "0.78rem",
                marginTop: 4,
                color: "rgba(240,236,230,0.6)",
              }}
            >
              {selectedItemNo} - {selectedWineName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(240,236,230,0.1)",
              border: "none",
              color: "#f0ece6",
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
    <div style={{ textAlign: "center", color: "#999" }}>
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
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={() => onDownload(originalPdfUrl, `${itemNo}.pdf`)}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "#5A1515",
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
            background: "#1a1a2e",
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
          background: "#f5f5f5",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #E5E5E5",
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
