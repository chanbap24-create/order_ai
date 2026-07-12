"use client";

import { WINE_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  clientName: string;
  clientCode: string;
  parsedItems: Array<{ raw?: string }>;
};

/** 요약 카드 — 거래처 + 파싱된 원본 라인 */
export function OrderSummaryCard({ clientName, clientCode, parsedItems }: Props) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          background: WINE_COLORS.surface,
          borderRadius: 12,
          border: `1px solid ${WINE_COLORS.dividerCard}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
          padding: "14px 18px",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: WINE_COLORS.text, marginBottom: 10 }}>
          요약
        </div>
        <div style={{ marginBottom: 10, fontSize: 14 }}>
          거래처: <b style={{ color: WINE_COLORS.primary }}>{clientName}</b>
          <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 12 }}>{clientCode}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {parsedItems.map((p, idx) => (
            <div key={idx} style={{ ...monoStyle, color: "#4a4540", fontSize: 13 }}>
              {String(p?.raw ?? "")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
