"use client";

type Props = {
  isNewItem: boolean;
  setIsNewItem: (v: boolean) => void;
  resetResults: () => void;
  hasResults: boolean;
  loading: boolean;
  canCalc: boolean;
  onCalculate: () => void;
  onExportExcel: () => void;
};

export function ConditionPanelHeader(p: Props) {
  return (
    <div
      style={{
        padding: "12px 24px",
        borderBottom: "1px solid var(--gray-200)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--neutral-900)" }}>수입량 예측</div>
        <div
          style={{
            display: "flex",
            gap: 0,
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--gray-200)",
          }}
        >
          {([{ v: false, label: "기존" }, { v: true, label: "신규" }] as const).map((opt) => (
            <button
              key={String(opt.v)}
              onClick={() => {
                p.setIsNewItem(opt.v);
                p.resetResults();
              }}
              style={{
                padding: "4px 14px",
                fontSize: 12,
                fontWeight: p.isNewItem === opt.v ? 600 : 400,
                background: p.isNewItem === opt.v ? "var(--neutral-900)" : "#fff",
                color: p.isNewItem === opt.v ? "#fff" : "var(--neutral-100)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {p.hasResults && (
          <button
            onClick={p.onExportExcel}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 500,
              background: "#fff",
              color: "var(--neutral-500)",
              border: "1px solid var(--gray-300)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Excel
          </button>
        )}
        <button
          onClick={p.onCalculate}
          disabled={!p.canCalc || p.loading}
          style={{
            padding: "7px 20px",
            fontSize: 13,
            fontWeight: 600,
            background: !p.canCalc || p.loading ? "var(--gray-200)" : "var(--action)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: !p.canCalc || p.loading ? "default" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {p.loading ? "분석 중..." : "분석"}
        </button>
      </div>
    </div>
  );
}
