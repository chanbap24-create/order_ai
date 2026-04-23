"use client";

import type { WarehouseTab } from "../types";

type Props = {
  activeTab: WarehouseTab;
  onSwitchTab: (tab: WarehouseTab) => void;
  showInvColumnSettings: boolean;
  onToggleInvColumnSettings: () => void;
  hasQuoteItems: boolean;
  exporting: boolean;
  onExport: () => void;
  exportingNotes: boolean;
  noteMenuOpen: boolean;
  setNoteMenuOpen: (v: boolean) => void;
  onDownloadNotes: (format: "pdf" | "pptx") => void;
};

/** Inventory 페이지 상단 헤더 — 타이틀 + CDV/DL 토글 + 컬럼설정 + 엑셀/T-Note 다운로드 */
export function Header({
  activeTab,
  onSwitchTab,
  showInvColumnSettings,
  onToggleInvColumnSettings,
  hasQuoteItems,
  exporting,
  onExport,
  exportingNotes,
  noteMenuOpen,
  setNoteMenuOpen,
  onDownloadNotes,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 0 12px",
      }}
    >
      <h1
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "#1a1a2e",
          margin: 0,
          fontFamily: "'Cormorant Garamond', serif",
          letterSpacing: "-0.01em",
        }}
      >
        Inventory & Quote
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TabSwitcher active={activeTab} onChange={onSwitchTab} />
        <SettingsButton active={showInvColumnSettings} onClick={onToggleInvColumnSettings} />
        <ExcelButton disabled={!hasQuoteItems || exporting} exporting={exporting} onClick={onExport} />
        <TastingNoteMenu
          disabled={!hasQuoteItems || exportingNotes}
          exporting={exportingNotes}
          open={noteMenuOpen}
          setOpen={setNoteMenuOpen}
          onDownload={onDownloadNotes}
        />
      </div>
    </div>
  );
}

function TabSwitcher({
  active,
  onChange,
}: {
  active: WarehouseTab;
  onChange: (t: WarehouseTab) => void;
}) {
  return (
    <div style={{ display: "flex", background: "#F0EFED", borderRadius: 8, padding: 2 }}>
      {(["CDV", "DL"] as WarehouseTab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: active === tab ? "white" : "transparent",
            color: active === tab ? "#5A1515" : "#999",
            boxShadow: active === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {tab === "CDV" ? "Wine" : "Riedel"}
        </button>
      ))}
    </div>
  );
}

function SettingsButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        background: active ? "rgba(90,21,21,0.08)" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        color: active ? "#5A1515" : "#999",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

function ExcelButton({
  disabled,
  exporting,
  onClick,
}: {
  disabled: boolean;
  exporting: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 14px",
        borderRadius: 6,
        border: "none",
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        background: !disabled || exporting ? "#1a1a2e" : "#E5E5E5",
        color: !disabled || exporting ? "white" : "#999",
        opacity: exporting ? 0.6 : 1,
      }}
    >
      {exporting ? "..." : "Excel"}
    </button>
  );
}

function TastingNoteMenu({
  disabled,
  exporting,
  open,
  setOpen,
  onDownload,
}: {
  disabled: boolean;
  exporting: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  onDownload: (format: "pdf" | "pptx") => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{
          padding: "5px 10px",
          borderRadius: 6,
          border: "none",
          fontSize: "0.7rem",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          background: !disabled || exporting ? "#8B1538" : "#E5E5E5",
          color: !disabled || exporting ? "white" : "#999",
          opacity: exporting ? 0.6 : 1,
        }}
      >
        {exporting ? "..." : "T-Note ▾"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "white",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            border: "1px solid #eee",
            zIndex: 100,
            overflow: "hidden",
            minWidth: 120,
          }}
        >
          <MenuItem onClick={() => onDownload("pdf")}>PDF 합본</MenuItem>
          <MenuItem topBorder onClick={() => onDownload("pptx")}>
            PPTX 합본
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
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
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f0ea")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 16px",
        border: "none",
        background: "white",
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left",
        borderTop: topBorder ? "1px solid #f0f0f0" : undefined,
      }}
    >
      {children}
    </button>
  );
}
