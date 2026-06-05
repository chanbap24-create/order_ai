"use client";

import { GLASS_COLORS } from "../constants";
import type { LearnRow } from "../hooks/useLearnInputs";

type Props = {
  open: boolean;
  toggleOpen: () => void;
  rows: LearnRow[];
  setField: (index: number, key: keyof LearnRow, value: string) => void;
  onSave: () => Promise<boolean> | void;
  onReset: () => void;
  canSave: boolean;
};

/**
 * 품목 학습 입력 카드 — 5행 자연어→정답 입력 + 저장/초기화 버튼.
 */
export function LearnInputCard({
  open,
  toggleOpen,
  rows,
  setField,
  onSave,
  onReset,
  canSave,
}: Props) {
  return (
    <div style={{ marginTop: 18 }}>
      <button onClick={toggleOpen} style={headerButtonStyle}>
        <span>품목 학습</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: GLASS_COLORS.surfaceBgAlt,
            borderRadius: 12,
          }}
        >
          <div style={{ color: "var(--neutral-300)", fontSize: 12, marginBottom: 10 }}>
            자연어 → 정답(표준 키워드/약어/정확한 품목명) 저장. 저장 즉시 resolve에 반영.
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input
                  value={row.alias}
                  onChange={(e) => setField(i, "alias", e.target.value)}
                  placeholder='자연어 (예: "뵈브 암발", "샤를루")'
                  style={inputStyle}
                />
                <input
                  value={row.canonical}
                  onChange={(e) => setField(i, "canonical", e.target.value)}
                  placeholder='정답 (예: "VA", "VA 샤를루 블랑 드 블랑 브륏")'
                  style={inputStyle}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                onClick={() => onSave()}
                disabled={!canSave}
                style={{
                  ...actionButtonStyle,
                  cursor: canSave ? "pointer" : "not-allowed",
                  opacity: canSave ? 1 : 0.5,
                }}
              >
                학습 저장
              </button>

              <button onClick={onReset} style={actionButtonStyle}>
                입력 초기화
              </button>

              <div
                style={{
                  marginLeft: "auto",
                  color: "var(--neutral-200)",
                  fontSize: 12,
                  alignSelf: "center",
                }}
              >
                저장 후 목록 자동 갱신됨
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const headerButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  background: GLASS_COLORS.surfaceBgAlt,
  border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
  borderRadius: 12,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 13,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 10,
  borderRadius: 10,
  border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
};

const actionButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  background: "#fff",
};
