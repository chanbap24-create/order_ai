"use client";

import type { ParseUsage } from "../types";

type Props = { usage: ParseUsage | null };

/** 하단 토큰 사용량 + 대략 비용 표시 */
export function TokenUsage({ usage }: Props) {
  if (!usage) return null;
  const cost = ((usage.input_tokens * 0.8 + usage.output_tokens * 4) / 1e6).toFixed(4);
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
    </div>
  );
}
