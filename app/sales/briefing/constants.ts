export const MEETING_TYPES: Record<string, { label: string; color: string }> = {
  visit: { label: '방문', color: '#2196F3' },
  call: { label: '전화', color: '#4CAF50' },
  tasting: { label: '시음', color: '#9C27B0' },
  delivery: { label: '납품', color: '#FF9800' },
};

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: '예정', color: '#1976D2', bg: '#E3F2FD' },
  confirmed: { label: '확정', color: '#E65100', bg: '#FFF3E0' },
  completed: { label: '완료', color: '#2E7D32', bg: '#E8F5E9' },
  cancelled: { label: '취소', color: '#757575', bg: '#F5F5F5' },
};

export const TAG_COLORS: Record<string, string> = {
  '재주문': '#2196F3', '선호국가': '#9C27B0', '선호품종': '#E91E63',
  '선호타입': '#00897B', '적정가격': '#4CAF50', '프리미엄': '#FF9800',
  '인기': '#FF5722', '통관필요': '#795548',
  '봄': '#66BB6A', '여름': '#29B6F6', '가을': '#FF7043', '겨울': '#5C6BC0',
};

export const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP', color: '#b71c1c' },
  2: { label: '중요', color: '#e65100' },
  3: { label: '보통', color: '#1565c0' },
  4: { label: '소규모', color: '#616161' },
  5: { label: '일반', color: '#9e9e9e' },
};

export const QUOTE_COL_OPTIONS: { key: string; label: string }[] = [
  { key: 'country', label: '국가' },
  { key: 'brand', label: '브랜드' },
  { key: 'region', label: '지역' },
  { key: 'grape_varieties', label: '포도품종' },
  { key: 'image_url', label: '이미지' },
  { key: 'vintage', label: '빈티지' },
  { key: 'product_name', label: '상품명' },
  { key: 'english_name', label: '영문명' },
  { key: 'supply_price', label: '공급가' },
  { key: 'retail_price', label: '판매가' },
  { key: 'discount_rate', label: '할인율' },
  { key: 'discounted_price', label: '할인가' },
  { key: 'quantity', label: '수량' },
  { key: 'normal_total', label: '정상합계' },
  { key: 'discount_total', label: '할인합계' },
  { key: 'tasting_note', label: '테이스팅노트' },
  { key: 'note', label: '비고' },
];

export const DEFAULT_BRIEFING_COLS = [
  'country', 'brand', 'region', 'grape_varieties',
  'image_url', 'vintage', 'product_name',
  'supply_price', 'retail_price', 'discount_rate', 'discounted_price',
  'tasting_note', 'note',
];
