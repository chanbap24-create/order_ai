export const PALETTE = [
  "#9B6B8A", "#7B9EA8", "#C4A882", "#8FAD88", "#B08EA2",
  "#A8886E", "#7E9BB5", "#C49B8A", "#8E8DB5", "#8CB4A0",
];

export const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "VIP", color: "#dc3545" },
  2: { label: "중요", color: "#fd7e14" },
  3: { label: "일반", color: "#6c757d" },
  4: { label: "간헐", color: "#adb5bd" },
  5: { label: "비활성", color: "#dee2e6" },
};

export const BUSINESS_TYPES = [
  "on/업소", "on/샵", "on/도매장", "on/호텔",
  "off/편의점", "off/할인점", "off/백화점",
  "백화점(와인)", "백화점(리빙)", "etc/기타",
  "업소", "샵", "호텔", "기물벤더", "온라인",
  "수입사", "와인도매장", "기업특판", "할인점", "리빙샵", "기타",
];

export const PREF_COLORS = [
  "#9B6B8A", "#7B9EA8", "#C4A882", "#8FAD88", "#B08EA2",
  "#A8886E", "#7E9BB5", "#C49B8A",
];

export const TASTE_COLORS: Record<string, string> = {
  "과일향": "#E8726E",
  "꽃향": "#F5A0C0",
  "오크/바닐라": "#D4A76A",
  "스파이스": "#C97B4B",
  "미네랄": "#8BAEC4",
  "견과류": "#B09070",
  "허브": "#7DB88F",
  "초콜릿/커피": "#7A5C4F",
  "흙/가죽": "#8B7D6B",
  "꿀/달콤": "#E8C36A",
};

export const DATE_PRESETS = [
  { value: "", label: "직접선택" },
  { value: "this_month", label: "이번달" },
  { value: "last_month", label: "지난달" },
  { value: "recent_3m", label: "최근3개월" },
  { value: "this_year", label: "올해" },
  { value: "last_year", label: "작년" },
];
