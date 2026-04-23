/** wine 페이지 도메인 타입 */

export type LearnRow = { alias: string; canonical: string };

export interface ParseItem {
  name?: string;
  raw?: string;
  qty?: number;
  item_no?: string;
  item_name?: string;
  resolved?: boolean;
  score?: number;
  is_new_item?: boolean;
  unit_price_hint?: number;
  suggestions?: Suggestion[];
  candidates?: Suggestion[];
}

export interface Suggestion {
  item_no?: string;
  code?: string;
  item_name?: string;
  score?: number;
  is_new_item?: boolean;
  in_client_history?: boolean;
  supply_price?: number;
  price?: number;
}

export interface ParseResult {
  success?: boolean;
  error?: string;
  status?: string;
  items?: ParseItem[];
  parsed_items?: Array<{ raw?: string }>;
  staff_message?: string;
  client?: {
    client_code?: string;
    client_name?: string;
    status?: string;
    candidates?: any[];
    hint_used?: string;
  };
  debug?: {
    orderText?: string;
    preprocessed_message?: string;
  };
  [k: string]: any;
}
