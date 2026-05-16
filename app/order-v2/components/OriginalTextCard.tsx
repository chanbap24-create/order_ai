"use client";

import { ORDER_COLORS, ORDER_FONT } from "../constants";

type Props = {
  orderText: string;
};

/**
 * 발주 원문을 결과 화면에서 보여주는 카드.
 * StaffMessageCard와 같은 카드 스타일로 디자인해 좌우 1:1 비교 시 시각적 매칭이 됨.
 */
export function OriginalTextCard({ orderText }: Props) {
  return (
    <div
      className="order-card"
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "16px 18px",
        border: "1px solid rgba(90,21,21,0.06)",
        boxShadow: "0 2px 12px rgba(90,21,21,0.03)",
        marginBottom: 16,
        transition: "box-shadow 0.3s ease",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            background: "linear-gradient(180deg, #8a8580, rgba(138,133,128,0.3))",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: ORDER_COLORS.text }}>
          발주 원문
        </span>
      </div>
      <pre
        style={{
          fontSize: 13,
          color: ORDER_COLORS.text,
          lineHeight: 1.75,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          margin: 0,
          fontFamily: ORDER_FONT.base,
          background: ORDER_COLORS.surfaceBg,
          borderRadius: 10,
          padding: "14px 16px",
          border: "1px solid rgba(90,21,21,0.04)",
          flex: 1,
          minHeight: 60,
        }}
      >
        {orderText.trim() || "(원문이 비어있습니다)"}
      </pre>
    </div>
  );
}
