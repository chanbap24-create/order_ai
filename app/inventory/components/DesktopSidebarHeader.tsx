"use client";

type Props = {
  itemCount: number;
  clientName: string;
  setClientName: (v: string) => void;
  clientNameFocused: boolean;
  setClientNameFocused: (v: boolean) => void;
  showDocSettings: boolean;
  setShowDocSettings: (v: boolean) => void;
  showQuoteColumnSettings: boolean;
  setShowQuoteColumnSettings: (v: boolean) => void;
  onClearAll: () => void;
};

/** 데스크톱 견적 사이드바 헤더 — 타이틀 + 카운트 + 거래처명 + 설정 + 전체 삭제 */
export function DesktopSidebarHeader({
  itemCount,
  clientName,
  setClientName,
  clientNameFocused,
  setClientNameFocused,
  showDocSettings,
  setShowDocSettings,
  showQuoteColumnSettings,
  setShowQuoteColumnSettings,
  onClearAll,
}: Props) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid #F0EFED",
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
        <input
          type="text"
          placeholder="거래처명"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          onFocus={() => setClientNameFocused(true)}
          onBlur={() => setClientNameFocused(false)}
          style={{
            width: 120,
            fontSize: 16,
            padding: "5px 10px",
            borderRadius: 8,
            border: `1.5px solid ${clientNameFocused ? "var(--action)" : "#E5E5E5"}`,
            outline: "none",
            boxShadow: clientNameFocused ? "0 0 0 3px rgba(90,21,21,0.06)" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
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
              border: "1px solid #e74c3c",
              background: "white",
              color: "#e74c3c",
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
        border: "1px solid #E5E5E5",
        background: active ? "rgba(90,21,21,0.08)" : "white",
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
