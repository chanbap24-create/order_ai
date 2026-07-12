/**
 * Glass 페이지 전역 상수
 * - 색/레이아웃 토큰, 매직 넘버, 메시지 템플릿 문자열
 */

export const GLASS_COLORS = {
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

export const GLASS_FONT = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

/** 후보 표시 개수 */
export const SUGGESTION_LIMITS = {
  /** 확정된 품목은 접힌 상태에서 2개만 */
  resolvedCollapsed: 2,
  /** 미확정 품목은 접힌 상태에서 5개 */
  unresolvedCollapsed: 5,
  /** 더보기 클릭 시 최대 20개 */
  expanded: 20,
} as const;

/** 학습 입력 행 기본 개수 */
export const LEARN_INPUT_ROWS = 5;

/** 클립보드 자동 체크 주기 (ms) */
export const CLIPBOARD_CHECK_INTERVAL_MS = 3000;

/** localStorage 키 */
export const STORAGE_KEYS = {
  autoPaste: "order_auto_paste",
} as const;

/** 직원 메시지 템플릿 */
export const STAFF_MESSAGE = {
  paymentConfirm: "입금확인후 출고.",
  invoiceRequest: "거래명세표 부탁드립니다.",
  orderClosing: "발주 요청드립니다.",
  /** 직원 메시지에서 배송 예정일 라인을 찾는 정규식 */
  deliveryDateLineRegex: /배송 예정일: .+/g,
  /** 마무리 문장(끝 마침표 유무 모두 매치) */
  orderClosingRegex: /발주 요청드립니다\.?/g,
} as const;

/** 빠른 선택 날짜 개수 (오늘 포함) */
export const QUICK_DELIVERY_DAYS = 7;

/** 한국어 요일 */
export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
