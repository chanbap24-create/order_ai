/** Inventory 색/레이아웃 토큰 */

export const INV_COLORS = {
  primary: "#5A1515",
  primaryDark: "#722F37",
  textTitle: "#1a1a2e",
  text: "#2c1810",
  textMuted: "#666",
  textFaint: "#999",
  surface: "#fff",
  surfaceBg: "#fafaf8",
  tableHeader: "#F0EFED",
  tableBorder: "#E5E5E5",
  success: "#10b981",
  danger: "#ef4444",
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
