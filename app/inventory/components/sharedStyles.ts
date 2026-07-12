import type { CSSProperties } from "react";

/** 견적 테이블 th */
export const qThStyle: CSSProperties = {
  padding: "10px 8px",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--border-default)",
  textAlign: "center",
  color: "var(--neutral-400)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

/** 견적 테이블 td */
export const qTdStyle: CSSProperties = {
  padding: "8px",
  fontSize: 13,
  whiteSpace: "nowrap",
};

/** 모달/시트 폼 라벨 */
export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--neutral-500)",
  marginBottom: 4,
};

/** 바텀시트/모달 입력 */
export const sheetInputStyle: CSSProperties = {
  width: "100%",
  fontSize: 16,
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--border-default)",
  boxSizing: "border-box",
  outline: "none",
};
