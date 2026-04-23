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

export type FridayChoice = "saturday" | "monday" | undefined;

export interface DeliveryDateInfo {
  date: Date;
  label: string;
  options?: { sat: Date; mon: Date };
}
