"use client";

import type { ParseUsage } from "../types";

type Props = { usage: ParseUsage | null; model?: string | null };

/** 하단 토큰 사용량 + 대략 비용 + (불확실 발주) 정밀 보정 표시 */
export function TokenUsage({ usage, model }: Props) {
  if (!usage) return null;
  const cost = ((usage.input_tokens * 0.8 + usage.output_tokens * 4) / 1e6).toFixed(4);
  // 에스컬레이션 여부: 매칭에 상위 모델(Sonnet)이 쓰였으면 "정밀 보정" 표시
  const escalated = !!model && /sonnet/i.test(model);
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 10,
        color: "#c8c0b8",
        marginBottom: 16,
        letterSpacing: "0.02em",
      }}
    >
      {usage.input_tokens.toLocaleString()} in / {usage.output_tokens.toLocaleString()} out · ~${cost}
      {escalated && (
        <span
          title="후보가 불확실해 상위 모델(Sonnet)로 정밀 재매칭한 발주입니다."
          style={{
            marginLeft: 8,
            padding: "1px 6px",
            borderRadius: 8,
            background: "#eef2ff",
            color: "#4f46e5",
            fontWeight: 600,
          }}
        >
          🔬 정밀 보정(Sonnet)
        </span>
      )}
    </div>
  );
}
