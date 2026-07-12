"use client";

import type { RefObject } from "react";
import { ORDER_COLORS, ORDER_FONT } from "../constants";

type Props = {
  textRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  autoPaste: boolean;
  toggleAutoPaste: () => void;
};

/** 발주 내용 textarea + 자동붙여넣기 토글 */
export function OrderTextareaSection({
  textRef,
  value,
  onChange,
  autoPaste,
  toggleAutoPaste,
}: Props) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 7,
        }}
      >
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: ORDER_COLORS.textMuted,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          발주 내용
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: ORDER_COLORS.textMuted, fontWeight: 500 }}>
            자동붙여넣기
          </span>
          <div
            onClick={toggleAutoPaste}
            style={{
              width: 36,
              height: 20,
              borderRadius: 12,
              cursor: "pointer",
              background: autoPaste ? ORDER_COLORS.confHigh : "#d8d3ce",
              position: "relative",
              transition: "background 0.2s ease",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: 2,
                left: autoPaste ? 18 : 2,
                transition: "left 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </div>
        </div>
      </div>
      <textarea
        ref={textRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="order-input"
        placeholder="카톡/문자 발주 내용을 붙여넣으세요"
        rows={6}
        style={{
          width: "100%",
          fontSize: 16,
          padding: "13px 14px",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          background: ORDER_COLORS.surfaceBg,
          color: ORDER_COLORS.text,
          outline: "none",
          resize: "vertical",
          fontFamily: ORDER_FONT.base,
          lineHeight: 1.6,
          boxSizing: "border-box",
          transition: "all 0.2s ease",
        }}
      />
    </div>
  );
}
