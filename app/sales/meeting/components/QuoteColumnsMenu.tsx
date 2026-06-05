"use client";

import { DEFAULT_MEETING_COLS, QUOTE_COL_OPTIONS } from "../constants";

type Props = {
  show: boolean;
  onToggle: () => void;
  onClose: () => void;
  quoteCols: string[];
  setQuoteCols: React.Dispatch<React.SetStateAction<string[]>>;
};

/** 견적서 컬럼 설정 메뉴 (⚙ 버튼 + 드롭다운) */
export function QuoteColumnsMenu(p: Props) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={p.onToggle}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--gray-300)",
          background: p.show ? "#f5f0eb" : "#fff",
          color: "var(--action)",
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="컬럼 설정"
      >
        ⚙
      </button>
      {p.show && (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 0,
            background: "#fff",
            border: "1px solid var(--gray-200)",
            borderRadius: 10,
            padding: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 300,
            width: 220,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--action)", marginBottom: 8 }}>
            견적서 컬럼
          </div>
          {QUOTE_COL_OPTIONS.map((col) => (
            <label
              key={col.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                fontSize: 13,
                cursor: "pointer",
                color: "#333",
              }}
            >
              <input
                type="checkbox"
                checked={p.quoteCols.includes(col.key)}
                onChange={() => {
                  p.setQuoteCols((prev) =>
                    prev.includes(col.key) ? prev.filter((k) => k !== col.key) : [...prev, col.key],
                  );
                }}
                style={{ width: 14, height: 14 }}
              />
              {col.label}
            </label>
          ))}
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            <button
              onClick={() => p.setQuoteCols(DEFAULT_MEETING_COLS)}
              style={{
                flex: 1,
                padding: "5px 0",
                borderRadius: 6,
                border: "1px solid var(--gray-300)",
                background: "#fff",
                fontSize: 11,
                cursor: "pointer",
                color: "#666",
              }}
            >
              초기화
            </button>
            <button
              onClick={p.onClose}
              style={{
                flex: 1,
                padding: "5px 0",
                borderRadius: 6,
                border: "none",
                background: "var(--action)",
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
