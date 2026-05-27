"use client";

import { QUOTE_COLUMNS } from "../constants/columns";
import type { QuoteColumnKey } from "../types";

type Props = {
  visibleColumns: QuoteColumnKey[];
  setVisibleColumns: (updater: (prev: QuoteColumnKey[]) => QuoteColumnKey[]) => void;
};

/** 견적 컬럼 표시/순서 설정 (좌/우 이동 + 체크박스 목록) */
export function QuoteColumnSettings({ visibleColumns, setVisibleColumns }: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 14,
        background: "#fafaf8",
        borderRadius: 8,
        border: "1px solid #F0EFED",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 8, color: "#2D2D2D" }}>
        견적 컬럼 (체크 + 순서 변경)
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", color: "#999", marginBottom: 4 }}>
          표시 순서 (◀▶ 로 이동)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {visibleColumns.map((key, idx) => {
            const col = QUOTE_COLUMNS.find((c) => c.key === key);
            if (!col) return null;
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "3px 6px",
                  borderRadius: 6,
                  background: "#fff",
                  border: "1px solid rgba(90,21,21,0.2)",
                  fontSize: 11,
                }}
              >
                <ArrowBtn
                  onClick={() =>
                    setVisibleColumns((prev) => {
                      if (idx === 0) return prev;
                      const a = [...prev];
                      [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
                      return a;
                    })
                  }
                  disabled={idx === 0}
                >
                  ◀
                </ArrowBtn>
                <span style={{ fontWeight: 600, color: "#2D2D2D" }}>{col.label}</span>
                <ArrowBtn
                  onClick={() =>
                    setVisibleColumns((prev) => {
                      if (idx === prev.length - 1) return prev;
                      const a = [...prev];
                      [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]];
                      return a;
                    })
                  }
                  disabled={idx === visibleColumns.length - 1}
                >
                  ▶
                </ArrowBtn>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {QUOTE_COLUMNS.map((col) => {
          const active = visibleColumns.includes(col.key);
          return (
            <label
              key={col.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                background: active ? "rgba(90,21,21,0.06)" : "#fff",
                border: `1px solid ${active ? "rgba(90,21,21,0.2)" : "#E5E5E5"}`,
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() =>
                  setVisibleColumns((prev) =>
                    prev.includes(col.key)
                      ? prev.filter((k) => k !== col.key)
                      : [...prev, col.key],
                  )
                }
                style={{ width: 14, height: 14 }}
              />
              {col.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ArrowBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        padding: "0 2px",
        fontSize: 11,
        color: disabled ? "#ddd" : "var(--action)",
      }}
    >
      {children}
    </button>
  );
}
