"use client";

import type { WarehouseTab } from "../types";
import { PageHeader } from "@/app/components/ui";

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

/**
 * Inventory 페이지 상단 헤더.
 * PageHeader primitive 사용 — sales/admin 페이지와 동일한 구조.
 */
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
    <PageHeader
      title="Inventory"
      actions={
        <>
          <TabSwitcher active={activeTab} onChange={onSwitchTab} />
          <SettingsButton
            active={showInvColumnSettings}
            onClick={onToggleInvColumnSettings}
          />
          <ExcelButton
            disabled={!hasQuoteItems || exporting}
            exporting={exporting}
            onClick={onExport}
          />
          <TastingNoteMenu
            disabled={!hasQuoteItems || exportingNotes}
            exporting={exportingNotes}
            open={noteMenuOpen}
            setOpen={setNoteMenuOpen}
            onDownload={onDownloadNotes}
          />
        </>
      }
    />
  );
}

function TabSwitcher({
  active,
  onChange,
}: {
  active: WarehouseTab;
  onChange: (t: WarehouseTab) => void;
}) {
  const options: { value: WarehouseTab; label: string }[] = [
    { value: "CDV", label: "까브드뱅" },
    { value: "DL", label: "대유라이프" },
  ];
  return (
    <div style={{ display: "flex", height: 28 }}>
      {options.map((o, idx) => {
        const isActive = active === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              minWidth: 80,
              padding: "0 14px",
              border: "1px solid var(--border-default)",
              background: isActive ? "var(--action)" : "var(--surface)",
              color: isActive ? "var(--text-on-primary)" : "var(--text-tertiary)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              borderRadius: idx === 0 ? "6px 0 0 6px" : "0 6px 6px 0",
              borderLeftWidth: idx === 0 ? 1 : 0,
              letterSpacing: "0.02em",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="컬럼 설정"
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: `1px solid ${active ? "var(--action)" : "var(--border-default)"}`,
        background: active ? "var(--surface-active)" : "var(--surface)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s ease, color 0.15s ease",
        color: active ? "var(--action)" : "var(--text-tertiary)",
      }}
    >
      <svg
        width="14"
        height="14"
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
        height: 28,
        padding: "0 12px",
        borderRadius: 6,
        border: "1px solid var(--action)",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "var(--action-muted)" : "var(--action)",
        color: disabled ? "var(--text-muted)" : "var(--text-on-primary)",
        opacity: exporting ? 0.6 : 1,
        letterSpacing: "0.02em",
        transition: "background 0.15s ease",
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
          height: 28,
          padding: "0 12px",
          borderRadius: 6,
          border: "1px solid var(--border-default)",
          fontSize: 12,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          background: "var(--surface)",
          color: disabled ? "var(--text-muted)" : "var(--text-primary)",
          opacity: exporting ? 0.6 : 1,
          letterSpacing: "0.02em",
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
            background: "var(--surface)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid var(--border-default)",
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
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface)")
      }
      style={{
        display: "block",
        width: "100%",
        padding: "10px 16px",
        border: "none",
        background: "var(--surface)",
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-primary)",
        borderTop: topBorder ? "1px solid var(--border-subtle)" : undefined,
      }}
    >
      {children}
    </button>
  );
}
