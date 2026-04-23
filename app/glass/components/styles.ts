import type { CSSProperties } from "react";
import { GLASS_COLORS, GLASS_FONT } from "../constants";

/** 입력 필드(인풋/텍스트에어리어) 기본 스타일 */
export const inputBaseStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${GLASS_COLORS.primaryBorder}`,
  fontSize: 16,
  background: GLASS_COLORS.surfaceBg,
  transition: "border-color 0.2s, box-shadow 0.2s",
  outline: "none",
};

/** 모노스페이스 텍스트어리어용 (모바일 자동 줌 방지 위해 fontSize 16) */
export const monoStyle: CSSProperties = {
  fontFamily: GLASS_FONT.mono,
  fontSize: 16,
};

/** 섹션 라벨 (거래처/발주 내용 등 대문자 캡션) */
export const sectionLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: GLASS_COLORS.textMuted,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

/** 카드 컨테이너(원형 그림자) */
export const softCardStyle: CSSProperties = {
  marginTop: 16,
  background: GLASS_COLORS.surface,
  borderRadius: 16,
  border: `1px solid ${GLASS_COLORS.dividerCard}`,
  boxShadow: GLASS_COLORS.primaryShadowSubtle,
  padding: "20px 18px 18px",
};

/** 입력 필드 포커스/블러 핸들러 묶음 */
export const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = GLASS_COLORS.primaryBorderFocus;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${GLASS_COLORS.primaryBgHover}`;
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = GLASS_COLORS.primaryBorder;
    e.currentTarget.style.boxShadow = "none";
  },
};

/** 사각 체크박스 아이콘 (가짜 체크박스) */
export const checkboxSquareStyle = (checked: boolean): CSSProperties => ({
  width: 20,
  height: 20,
  borderRadius: 6,
  border: checked ? "none" : `1.5px solid ${GLASS_COLORS.primaryBorderStrong}`,
  background: checked ? GLASS_COLORS.primary : GLASS_COLORS.surface,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  flexShrink: 0,
});

/** 토글 날짜/옵션 헤더 버튼 */
export const toggleHeaderStyle: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 14,
  fontWeight: 600,
  color: GLASS_COLORS.text,
};
