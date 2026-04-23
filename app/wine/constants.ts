/**
 * Wine 페이지 전역 상수.
 * - 색/토큰, 매직 넘버, 메시지 템플릿 문자열
 * - 와인 단위는 항상 "병"
 */

export const WINE_COLORS = {
  primary: "#5A1515",
  primaryBgSubtle: "rgba(90,21,21,0.02)",
  primaryBgLight: "rgba(90,21,21,0.04)",
  primaryBgHover: "rgba(90,21,21,0.06)",
  primaryBorder: "rgba(90,21,21,0.08)",
  primaryBorderStrong: "rgba(90,21,21,0.15)",
  primaryBorderFocus: "rgba(90,21,21,0.25)",
  primaryShadow: "0 2px 8px rgba(90,21,21,0.2)",
  primaryShadowSubtle: "0 2px 8px rgba(90,21,21,0.03)",
  primaryShadowFaint: "0 1px 3px rgba(90,21,21,0.03)",

  text: "#2c1810",
  textMuted: "#8a8580",
  textDisabled: "#ccc",
  textHelper: "#8a7a6e",

  surface: "#fff",
  surfaceBg: "#faf9f7",
  surfaceBgAlt: "#fafaf8",
  dividerFaint: "rgba(90,21,21,0.05)",
  dividerCard: "rgba(90,21,21,0.06)",
  dividerCardLight: "rgba(90,21,21,0.1)",

  toggleOff: "#d4d0cc",

  danger: "#c0392b",
  dangerStrong: "#dc2626",
  dangerBg: "rgba(220,38,38,0.05)",
  dangerBorder: "rgba(220,38,38,0.15)",

  warningText: "#92400e",
  warningBg: "rgba(217,119,6,0.05)",
  warningBorder: "rgba(217,119,6,0.15)",

  success: "#10b981",
  neutralBorder: "#d1d5db",
  neutralTextMuted: "#6b7280",
  neutralIcon: "#9ca3af",
} as const;

export const WINE_FONT = {
  base: "'DM Sans', -apple-system, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

/** 와인은 항상 "병" 단위 */
export const WINE_UNIT = "병" as const;

/** 후보 표시 개수 (wine은 unresolved 10개) */
export const SUGGESTION_LIMITS = {
  resolvedCollapsed: 2,
  unresolvedCollapsed: 10,
  expanded: 20,
} as const;

export const LEARN_INPUT_ROWS = 5;

export const CLIPBOARD_CHECK_INTERVAL_MS = 3000;
export const COPY_FEEDBACK_MS = 900;
export const AUTO_COPY_DELAY_MS = 300;

export const STORAGE_KEYS = {
  autoPaste: "order_auto_paste",
} as const;

/** 직원 메시지 템플릿 */
export const STAFF_MESSAGE = {
  paymentConfirm: "입금확인후 출고.",
  invoiceRequest: "거래명세표 부탁드립니다.",
  orderClosing: "발주 요청드립니다.",
  deliveryDateLineRegex: /배송 예정일: .+/g,
  orderClosingRegex: /발주 요청드립니다\.?/g,
} as const;

export const QUICK_DELIVERY_DAYS = 7;

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
