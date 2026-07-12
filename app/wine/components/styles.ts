import type { CSSProperties } from "react";
import { WINE_COLORS, WINE_FONT } from "../constants";

export const inputBaseStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${WINE_COLORS.primaryBorder}`,
  fontSize: 16,
  background: WINE_COLORS.surfaceBg,
  transition: "border-color 0.2s, box-shadow 0.2s",
  outline: "none",
};

export const monoStyle: CSSProperties = {
  fontFamily: WINE_FONT.mono,
  fontSize: 16,
};

export const sectionLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: WINE_COLORS.textMuted,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

export const softCardStyle: CSSProperties = {
  marginTop: 16,
  background: WINE_COLORS.surface,
  borderRadius: 12,
  border: `1px solid ${WINE_COLORS.dividerCard}`,
  boxShadow: WINE_COLORS.primaryShadowSubtle,
  padding: "20px 18px 18px",
};

export const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = WINE_COLORS.primaryBorderFocus;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${WINE_COLORS.primaryBgHover}`;
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = WINE_COLORS.primaryBorder;
    e.currentTarget.style.boxShadow = "none";
  },
};

export const checkboxSquareStyle = (checked: boolean): CSSProperties => ({
  width: 20,
  height: 20,
  borderRadius: 6,
  border: checked ? "none" : `1.5px solid ${WINE_COLORS.primaryBorderStrong}`,
  background: checked ? WINE_COLORS.primary : WINE_COLORS.surface,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  flexShrink: 0,
});

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
  color: WINE_COLORS.text,
};
