/** Inventory 색/레이아웃 토큰 */

export const INV_COLORS = {
  primary: "var(--action)",
  primaryDark: "#722F37",
  textTitle: "#1a1a2e",
  text: "var(--text-primary)",
  textMuted: "var(--neutral-400)",
  textFaint: "var(--neutral-100)",
  surface: "#fff",
  surfaceBg: "var(--gray-50)",
  tableHeader: "var(--gray-100)",
  tableBorder: "var(--gray-200)",
  success: "var(--color-success)",
  danger: "var(--color-error)",
} as const;

/** 최대 페이지 폭 */
export const INV_MAX_WIDTH = 1440;

/** 모바일 브레이크포인트 (px) */
export const MOBILE_BREAKPOINT = 768;

/** "추가됨" 피드백 유지 시간 */
export const ADDED_FEEDBACK_MS = 1200;

/** localStorage 키 */
export const STORAGE_KEYS = {
  activeTab: "inventory_active_tab",
  visibleColumnsCDV: "inventory_columns_cdv",
  visibleColumnsDL: "inventory_columns_dl",
  quoteVisibleColumnsCDV: "inventory_quote_columns_cdv",
  quoteVisibleColumnsDL: "inventory_quote_columns_dl",
  docSettingsCDV: "inventory_doc_settings_cdv",
  docSettingsDL: "inventory_doc_settings_dl",
} as const;

/** sessionStorage 키 (검색상태) */
export const SESSION_KEYS = {
  searchState: "inventory_search_state",
} as const;
