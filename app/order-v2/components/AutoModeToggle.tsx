"use client";

import { useState } from "react";
import { ORDER_COLORS } from "../constants";
import type { AutoResult } from "../hooks/useOrderBatch";

type Props = {
  on: boolean;
  onToggle: (v: boolean) => void;
  autoResult: AutoResult | null;
};

/**
 * 자동 발주 ON/OFF 토글.
 * ON이면 스샷을 넣는 순간 추출→매칭→파싱→(불확정 0이면) 복사까지 자동.
 * 결과 토스트는 모바일 클립보드 차단 대비 "탭하면 다시 복사" 동작.
 */
export function AutoModeToggle({ on, onToggle, autoResult }: Props) {
  const [recopied, setRecopied] = useState(false);

  const recopy = () => {
    if (!autoResult?.message) return;
    navigator.clipboard.writeText(autoResult.message).catch(() => {});
    setRecopied(true);
    setTimeout(() => setRecopied(false), 1500);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ORDER_COLORS.text }}>
          ⚡ 자동 발주
          <span style={{ fontSize: 11, fontWeight: 500, color: ORDER_COLORS.textMuted, marginLeft: 6 }}>
            스샷 넣으면 복사까지 자동
          </span>
        </div>
        <button
          onClick={() => onToggle(!on)}
          aria-pressed={on}
          style={{
            marginLeft: "auto",
            position: "relative",
            width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
            background: on ? "var(--action)" : "var(--border-default)",
            transition: "background 0.15s ease",
          }}
        >
          <span
            style={{
              position: "absolute", top: 3, left: on ? 23 : 3,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.15s ease",
            }}
          />
        </button>
        <span style={{ fontSize: 12, fontWeight: 800, color: on ? ORDER_COLORS.confHigh : ORDER_COLORS.textMuted, minWidth: 26 }}>
          {on ? "ON" : "OFF"}
        </span>
      </div>

      {on && autoResult && autoResult.copied && (
        <button
          onClick={recopy}
          style={{
            marginTop: 8, width: "100%", textAlign: "left",
            padding: "10px 13px", borderRadius: 8, cursor: "pointer",
            border: "1px solid rgba(120,160,90,0.4)",
            background: "rgba(120,160,90,0.12)", color: ORDER_COLORS.confHigh,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5,
          }}
        >
          {recopied
            ? "✓ 다시 복사됨"
            : `✓ ${autoResult.ready}건 자동 완료 — 복사됨. 안 됐으면 여기를 탭하면 다시 복사됩니다.`}
        </button>
      )}
      {on && autoResult && !autoResult.copied && (
        <div
          style={{
            marginTop: 8, padding: "10px 13px", borderRadius: 8,
            background: "rgba(200,140,40,0.10)", color: ORDER_COLORS.confLow,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5,
          }}
        >
          {`${autoResult.ready}건 준비 · 확인필요 ${autoResult.attention}건 — 아래에서 확인·수정 후 복사하세요.`}
        </div>
      )}
    </div>
  );
}
