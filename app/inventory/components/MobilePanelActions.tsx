"use client";

type Props = {
  hasItems: boolean;
  exporting: boolean;
  exportingNotes: boolean;
  onExport: () => void;
  noteMenuOpen: boolean;
  setNoteMenuOpen: (v: boolean) => void;
  onDownloadNotes: (format: "pdf" | "pptx") => void;
  onClearAll: () => void;
};

/** 모바일 패널 하단 액션 바 — Excel 출력 / T-Note 드롭다운 / 전체 삭제 */
export function MobilePanelActions({
  hasItems,
  exporting,
  exportingNotes,
  onExport,
  noteMenuOpen,
  setNoteMenuOpen,
  onDownloadNotes,
  onClearAll,
}: Props) {
  return (
    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
      <button
        onClick={onExport}
        disabled={exporting || !hasItems}
        style={{
          flex: 1,
          height: 44,
          borderRadius: 8,
          border: "none",
          background: hasItems ? "#1a1a2e" : "var(--gray-200)",
          color: hasItems ? "white" : "var(--neutral-100)",
          fontSize: 14,
          fontWeight: 600,
          cursor: hasItems ? "pointer" : "not-allowed",
          opacity: exporting ? 0.6 : 1,
        }}
      >
        {exporting ? "생성 중..." : "Excel 출력"}
      </button>

      <div style={{ position: "relative", flex: 1 }}>
        <button
          onClick={() => setNoteMenuOpen(!noteMenuOpen)}
          disabled={exportingNotes || !hasItems}
          style={{
            width: "100%",
            height: 44,
            borderRadius: 8,
            border: "none",
            background: hasItems ? "var(--color-primary-light)" : "var(--gray-200)",
            color: hasItems ? "white" : "var(--neutral-100)",
            fontSize: 14,
            fontWeight: 600,
            cursor: hasItems ? "pointer" : "not-allowed",
            opacity: exportingNotes ? 0.6 : 1,
          }}
        >
          {exportingNotes ? "생성 중..." : "T-Note ▾"}
        </button>
        {noteMenuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              right: 0,
              marginBottom: 4,
              background: "white",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              border: "1px solid var(--gray-200)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            <FormatBtn onClick={() => { setNoteMenuOpen(false); onDownloadNotes("pdf"); }}>
              PDF 합본
            </FormatBtn>
            <FormatBtn topBorder onClick={() => { setNoteMenuOpen(false); onDownloadNotes("pptx"); }}>
              PPTX 합본
            </FormatBtn>
          </div>
        )}
      </div>

      {hasItems && (
        <button
          onClick={onClearAll}
          style={{
            height: 44,
            padding: "0 16px",
            borderRadius: 8,
            border: "1px solid var(--status-danger)",
            background: "white",
            color: "var(--status-danger)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          전체 삭제
        </button>
      )}
    </div>
  );
}

function FormatBtn({
  onClick,
  topBorder,
  children,
}: {
  onClick: () => void;
  topBorder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "12px 16px",
        border: "none",
        background: "white",
        fontSize: 14,
        cursor: "pointer",
        textAlign: "center",
        borderTop: topBorder ? "1px solid var(--gray-100)" : undefined,
      }}
    >
      {children}
    </button>
  );
}
