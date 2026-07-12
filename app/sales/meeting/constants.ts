export const MEETING_TYPES: Record<string, { label: string; color: string }> = {
  visit: { label: "방문", color: "var(--meeting-visit)" },
  call: { label: "전화", color: "var(--meeting-call)" },
  tasting: { label: "시음", color: "var(--meeting-tasting)" },
  delivery: { label: "납품", color: "var(--meeting-delivery)" },
  meeting: { label: "회의", color: "var(--meeting-internal)" },
  other: { label: "기타", color: "var(--meeting-other)" },
  company: { label: "회사일정", color: "var(--meeting-company)" },
};

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: "예정", color: "var(--status-info)", bg: "var(--status-info-bg)" },
  confirmed: { label: "확정", color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
  completed: { label: "완료", color: "var(--status-success)", bg: "var(--status-success-bg)" },
  cancelled: { label: "취소", color: "var(--neutral-300)", bg: "var(--gray-100)" },
};

export const STATUS_FLOW = ["planned", "confirmed", "completed"];

export const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "VIP", color: "var(--status-danger)" },
  2: { label: "중요", color: "var(--importance-high)" },
  3: { label: "일반", color: "var(--importance-normal)" },
  4: { label: "간헐", color: "var(--importance-low)" },
  5: { label: "비활성", color: "var(--importance-inactive)" },
};

export const TAG_COLORS: Record<string, string> = {
  재주문: "#2196F3",
  선호국가: "#9C27B0",
  선호품종: "#E91E63",
  선호타입: "#00897B",
  적정가격: "#4CAF50",
  프리미엄: "#FF9800",
  인기: "#FF5722",
  통관필요: "#795548",
  봄: "#66BB6A",
  여름: "#29B6F6",
  가을: "#FF7043",
  겨울: "#5C6BC0",
};

export const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "기본값(30분)" },
  { value: 0, label: "없음" },
  { value: 5, label: "5분 전" },
  { value: 10, label: "10분 전" },
  { value: 15, label: "15분 전" },
  { value: 30, label: "30분 전" },
  { value: 60, label: "1시간 전" },
];

export const DEFAULT_REMINDER_MINUTES = 30;

export const QUOTE_COL_OPTIONS: { key: string; label: string }[] = [
  { key: "country", label: "국가" },
  { key: "brand", label: "브랜드" },
  { key: "region", label: "지역" },
  { key: "grape_varieties", label: "포도품종" },
  { key: "image_url", label: "이미지" },
  { key: "vintage", label: "빈티지" },
  { key: "product_name", label: "상품명" },
  { key: "english_name", label: "영문명" },
  { key: "supply_price", label: "공급가" },
  { key: "retail_price", label: "판매가" },
  { key: "discount_rate", label: "할인율" },
  { key: "discounted_price", label: "할인가" },
  { key: "quantity", label: "수량" },
  { key: "normal_total", label: "정상합계" },
  { key: "discount_total", label: "할인합계" },
  { key: "tasting_note", label: "테이스팅노트" },
  { key: "note", label: "비고" },
];

export const DEFAULT_MEETING_COLS = [
  "country", "brand", "region", "grape_varieties",
  "image_url", "vintage", "product_name",
  "supply_price", "retail_price", "discount_rate", "discounted_price",
  "tasting_note", "note",
];
