"use client";

import { GLASS_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  clientName: string;
  clientCode: string;
  parsedItems: any[];
};

/**
 * 요약 카드 — 거래처 이름/코드 + 파싱된 원본 라인.
 */
export function OrderSummaryCard({ clientName, clientCode, parsedItems }: Props) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          background: GLASS_COLORS.surface,
          borderRadius: 16,
          border: `1px solid ${GLASS_COLORS.dividerCard}`,
          boxShadow: "0 1px 4px rgba(90,21,21,0.02)",
          padding: "14px 18px",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: GLASS_COLORS.text, marginBottom: 10 }}>
          요약
        </div>
        <div style={{ marginBottom: 10, fontSize: 14 }}>
          거래처: <b style={{ color: GLASS_COLORS.primary }}>{clientName}</b>
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
