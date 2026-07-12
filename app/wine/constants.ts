/**
 * Wine 페이지 전역 상수.
 * - 색/토큰, 매직 넘버, 메시지 템플릿 문자열
 * - 와인 단위는 항상 "병"
 */

export const WINE_COLORS = {
  primary: "var(--action)",
  primaryBgSubtle: "var(--surface-hover)",
  primaryBgLight: "var(--border-subtle)",
  primaryBgHover: "var(--action-muted)",
  primaryBorder: "var(--border-default)",
  primaryBorderStrong: "var(--border-strong)",
  primaryBorderFocus: "var(--border-strong)",
  primaryShadow: "0 2px 8px rgba(0,0,0,0.2)",
  primaryShadowSubtle: "0 2px 8px rgba(0,0,0,0.03)",
  primaryShadowFaint: "0 1px 3px rgba(0,0,0,0.03)",

  text: "var(--text-primary)",
  textMuted: "var(--text-tertiary)",
  textDisabled: "#ccc",
  textHelper: "#8a7a6e",

  surface: "#fff",
  surfaceBg: "var(--surface-muted)",
  surfaceBgAlt: "#fafaf8",
  dividerFaint: "var(--border-subtle)",
  dividerCard: "var(--action-muted)",
  dividerCardLight: "var(--border-default)",

  toggleOff: "#d4d0cc",

  danger: "var(--status-danger)",
  dangerStrong: "var(--status-danger)",
  dangerBg: "rgba(220,38,38,0.05)",
  dangerBorder: "rgba(220,38,38,0.15)",

  warningText: "#92400e",
  warningBg: "rgba(217,119,6,0.05)",
  warningBorder: "rgba(217,119,6,0.15)",

  success: "var(--color-success)",
  neutralBorder: "#d1d5db",
  neutralTextMuted: "#6b7280",
  neutralIcon: "#9ca3af",
} as const;

export const WINE_FONT = {
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
