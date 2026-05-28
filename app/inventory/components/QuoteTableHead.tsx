"use client";

import type { QuoteColumnConfig } from "../types";
import { qThStyle } from "./sharedStyles";

type Props = {
  visibleQuoteCols: QuoteColumnConfig[];
  onReorderColumns: (
    updater: (prev: QuoteColumnConfig[]) => QuoteColumnConfig[],
  ) => void;
};

/** 견적 테이블 헤더 — 순서 열 + 각 칼럼 ◀▶ 순서 변경 버튼 */
export function QuoteTableHead({ visibleQuoteCols, onReorderColumns }: Props) {
  return (
    <thead style={{ position: "sticky", top: 0, zIndex: 4 }}>
      <tr style={{ background: "#fafaf8" }}>
        <th style={{
          ...qThStyle,
          width: 60,
          position: "sticky",
          left: 0,
          background: "#fafaf8",
          zIndex: 5,
          boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)",
        }}>순서</th>
        {visibleQuoteCols.map((col, ci) => (
          <th
            key={col.key}
            style={{
              ...qThStyle,
              background: "#fafaf8",
              textAlign:
                col.type === "currency" || col.type === "computed"
                  ? "right"
                  : "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <ArrowBtn
                disabled={ci === 0}
                onClick={() =>
                  onReorderColumns((prev) => {
                    if (ci === 0) return prev;
                    const a = [...prev];
                    [a[ci - 1], a[ci]] = [a[ci], a[ci - 1]];
                    return a;
                  })
                }
              >
                ◀
              </ArrowBtn>
              <span>{col.label}</span>
              <ArrowBtn
                disabled={ci === visibleQuoteCols.length - 1}
                onClick={() =>
                  onReorderColumns((prev) => {
                    if (ci === prev.length - 1) return prev;
                    const a = [...prev];
                    [a[ci], a[ci + 1]] = [a[ci + 1], a[ci]];
                    return a;
                  })
                }
              >
                ▶
              </ArrowBtn>
            </div>
          </th>
        ))}
        <th style={{ ...qThStyle, width: 36, background: "#fafaf8" }}></th>
      </tr>
    </thead>
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
        padding: 0,
        fontSize: 9,
        color: disabled ? "#ddd" : "#999",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
