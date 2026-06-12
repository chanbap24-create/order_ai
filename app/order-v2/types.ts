/** order-v2 도메인 타입 */

export type OrderTab = "CDV" | "DL";

export interface Client {
  client_code: string;
  client_name: string;
  matched_alias?: string;
}

export interface Candidate {
  item_no: string;
  item_name: string;
  confidence: number;
  supply_price: number;
  available_stock: number;
  reasoning: string;
  incoming?: { arrival_date: string; total_btls: number };
}

export interface OrderLine {
  query: string;
  quantity: number;
  candidates: Candidate[];
  /** 선택된 후보 인덱스 (-1이면 미선택) */
  selectedIdx: number;
  /** 수량 크로스체크 경고 */
  qty_warning?: string;
  /** LLM이 원래 반환한 수량 (보정 전) */
  qty_original_llm?: number;
  /** 로컬 검수 에이전트가 1순위 변경/의심 표시한 사유 (있으면 UI에 뱃지 노출) */
  review_note?: string;
  /** 파싱 직후 LLM 1순위 품번 (학습용: 최종 선택이 이와 다르면 '정정'으로 간주) */
  llm_top_item_no?: string;
}

export interface SearchResult {
  item_no: string;
  item_name: string;
  supply_price: number;
  available_stock: number;
}

export interface HistoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  buy_count: number;
  last_ship_date: string;
}

export interface ParseUsage {
  input_tokens: number;
  output_tokens: number;
}

/** 배치(발주 인박스) 한 건의 처리 상태 */
export type BatchStatus =
  | "extracting" // 스샷 분석 중
  | "parsing" // 발주 파싱 중
  | "ready" // 자신 있음 (거래처 매칭 + 후보 확실)
  | "needs_client" // 거래처 매칭 애매/실패
  | "needs_review" // 품목 후보 애매
  | "error"; // 추출/파싱 실패

export interface BatchOrder {
  id: string;
  fileName: string;
  clientHint: string;
  client: Client | null;
  clientOptions: Client[];
  orderText: string;
  orderLines: OrderLine[];
  historySet: Set<string>;
  status: BatchStatus;
  error?: string;
}

export type FridayChoice = "saturday" | "monday" | undefined;

export interface DeliveryDateInfo {
  date: Date;
  label: string;
  options?: { sat: Date; mon: Date };
}
