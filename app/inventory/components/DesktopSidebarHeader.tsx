"use client";

import { ClientSearchInput } from "./ClientSearchInput";

type Props = {
  itemCount: number;
  clientName: string;
  setClientName: (v: string) => void;
  setClientCode: (v: string | null) => void;
  company: string;
  clientNameFocused: boolean;
  setClientNameFocused: (v: boolean) => void;
  showDocSettings: boolean;
  setShowDocSettings: (v: boolean) => void;
  showQuoteColumnSettings: boolean;
  setShowQuoteColumnSettings: (v: boolean) => void;
  onOpenSaved: () => void;
  onClearAll: () => void;
};

/** 데스크톱 견적 사이드바 헤더 — 타이틀 + 카운트 + 거래처 + 저장견적/설정 + 전체 삭제 */
export function DesktopSidebarHeader({
  itemCount,
  clientName,
  setClientName,
  setClientCode,
  company,
  clientNameFocused,
  setClientNameFocused,
  showDocSettings,
  setShowDocSettings,
  showQuoteColumnSettings,
  setShowQuoteColumnSettings,
  onOpenSaved,
  onClearAll,
}: Props) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--gray-100)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        position: "sticky",
        top: 0,
        background: "white",
        borderRadius: "12px 12px 0 0",
        zIndex: 1,
      }}
    >
      <span
        style={{
          fontSize: "0.92rem",
          fontWeight: 700,
          color: "#1a1a2e",
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        Quote
      </span>
      {itemCount > 0 && (
        <span
          style={{
            background: "var(--action)",
            color: "white",
            borderRadius: 10,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {itemCount}
        </span>
      )}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        <ClientSearchInput
          clientName={clientName}
          setClientName={setClientName}
          setClientCode={setClientCode}
          focused={clientNameFocused}
          setFocused={setClientNameFocused}
          company={company}
          width={130}
        />
        <IconBtn active={false} onClick={onOpenSaved} title="저장된 견적">
          🗂
        </IconBtn>
        <IconBtn
          active={showDocSettings}
          onClick={() => setShowDocSettings(!showDocSettings)}
          title="문서 설정"
        >
          📄
        </IconBtn>
        <IconBtn
          active={showQuoteColumnSettings}
          onClick={() => setShowQuoteColumnSettings(!showQuoteColumnSettings)}
          title="컬럼 설정"
        >
          ⚙
        </IconBtn>
        {itemCount > 0 && (
          <button
            onClick={onClearAll}
            style={{
              padding: "3px 8px",
              borderRadius: 8,
              border: "1px solid var(--status-danger)",
              background: "white",
              color: "var(--status-danger)",
              fontSize: "0.68rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            전체 삭제
          </button>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: "1px solid var(--gray-200)",
        background: active ? "var(--border-default)" : "white",
        cursor: "pointer",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
