/** order-v2 상수/토큰/메시지 템플릿 */

export const ORDER_COLORS = {
  primary: "var(--action)",
  text: "var(--text-primary)",
  textTitle: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  surface: "#fff",
  surfaceBg: "var(--surface-muted)",

  confHigh: "var(--status-success)",    // 확실 >= 0.9
  confMid: "var(--status-info)",     // 높음 >= 0.7
  confLow: "var(--status-warning)",     // 중간 >= 0.5
  confNone: "var(--status-danger)",    // 불확실 < 0.5
} as const;

export const ORDER_FONT = {
  base: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif",
  display: "'Pretendard Variable', Pretendard, -apple-system, sans-serif",
} as const;

/** 배송일 컷오프 (KST 분 단위) — CDV 16:31, DL 16:01 */
export const DELIVERY_CUTOFF = {
  CDV: 16 * 60 + 31,
  DL: 16 * 60 + 1,
} as const;

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 신뢰도 구간 임계값 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.9,    // 확실
  mid: 0.7,     // 높음
  low: 0.5,     // 중간
} as const;

/** debounce (ms) */
export const DEBOUNCE_MS = {
  clientSearch: 300,
  wineSearch: 300,
} as const;

/** 복사 완료 표시 유지 시간 (ms) */
export const COPY_FEEDBACK_MS = 2000;

/** 배송 특이사항 프리셋 */
export const DELIVERY_PRESETS = [
  "입금확인후출고",
  "명세표부탁드립니다.",
  "계산서발행부탁드립니다.",
  "배송 전 연락바랍니다.",
  "부재시 경비실에 맡겨주세요.",
] as const;

export const STORAGE_KEYS = {
  autoPaste: "order_auto_paste",
} as const;

/** 거래처 드롭다운 최대 높이 (px) */
export const CLIENT_DROPDOWN_MAX_HEIGHT = 240;
