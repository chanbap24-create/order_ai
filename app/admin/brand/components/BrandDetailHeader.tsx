"use client";

type Props = {
  isNew: boolean;
  hasSelectedBrand: boolean;
  researching: boolean;
  saving: boolean;
  onBack: () => void;
  onResearch: () => void;
  onDelete: () => void;
  onSave: () => void;
};

export function BrandDetailHeader(p: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <button
        onClick={p.onBack}
        style={{
          background: "none",
          border: "none",
          fontSize: 13,
          color: "var(--action)",
          cursor: "pointer",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        목록
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={p.onResearch}
        disabled={p.researching}
        style={{
          height: 34,
          padding: "0 14px",
          background: p.researching ? "#ccc" : "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          cursor: p.researching ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {p.researching ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            조사 중...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            AI 조사
          </>
        )}
      </button>
      {!p.isNew && p.hasSelectedBrand && (
        <button
          onClick={p.onDelete}
          style={{
            height: 34,
            padding: "0 12px",
            background: "rgba(220,53,69,0.08)",
            color: "#dc3545",
            border: "none",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          삭제
        </button>
      )}
      <button
        onClick={p.onSave}
        disabled={p.saving}
        style={{
          height: 34,
          padding: "0 18px",
          background: p.saving ? "#ccc" : "var(--action)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          cursor: p.saving ? "default" : "pointer",
        }}
      >
        {p.saving ? "저장 중..." : "저장"}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
