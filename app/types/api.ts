// API 요청/응답 타입 정의

// ==================== 공통 타입 ====================

export type ApiResponse<T = unknown> = {
  success: boolean;
  error?: string;
  code?: string;
} & T;

// ==================== resolve-client ====================

export type ResolveClientRequest = {
  message?: string;
  client_hint?: string;
  force_resolve?: boolean;
};

export type ClientInfo = {
  status: "resolved" | "needs_review";
  client_code?: string;
  client_name?: string;
  score?: number;
  method?: string;
  candidates?: Array<{
    client_name: string;
    client_code: string;
    score: number;
  }>;
  hint_used?: string;
};

export type ResolveClientResponse = ApiResponse<{
  status: "resolved" | "needs_review_client";
  client?: ClientInfo;
}>;

// ==================== parse-full-order ====================

export type ParseFullOrderRequest = {
  message: string;
  force_resolve?: boolean;
};

export type ItemInfo = {
  raw: string;
  qty: number;
  resolved: boolean;
  item_no: string | null;
  item_name: string;
  unit_price_hint: number | null;
  suggestions?: Array<{
    item_no: string;
    item_name: string;
    score?: number;
  }>;
};

export type ParseFullOrderResponse = ApiResponse<{
  status: "resolved" | "needs_review_client" | "needs_review_items";
  client?: ClientInfo;
  parsed_items?: Array<{
    name: string;
    qty: number;
  }>;
  items?: ItemInfo[];
  staff_message?: string;
  debug?: {
    preprocessed_message?: string;
    translation_message?: string;
    preprocessed_orderText?: string;
    translation_order?: string;
  };
}>;

// ==================== parse-order ====================

export type ParseOrderRequest = {
  clientCode: string;
  orderText: string;
};

export type ParseOrderLineResult = {
  raw: string;
  qty: number | null;
  status: "matched" | "needs_review";
  item_no: string | null;
  item_name: string;
  unit_price_hint: number | null;
  candidates: Array<{
    item_no: string;
    item_name: string;
    score: number;
  }>;
};

export type ParseOrderResponse = {
  client_code: string;
  lines: ParseOrderLineResult[];
};

// ==================== parse ====================

export type ParseRequest = {
  text: string;
};

export type ParsedItem = {
  code: string;
  name: string;
  qty: number;
  price: number | null;
};

export type ParseResponse = {
  clientName: string;
  deliveryLine: string;
  items: ParsedItem[];
  staffMessage: string;
  clientMessage: string;
};

// ==================== learn-item-alias ====================

export type LearnItemAliasRequest = {
  alias: string;
  canonical: string;
};

export type LearnItemAliasResponse = ApiResponse<{
  success: true;
}>;

// ==================== confirm-item-alias ====================

export type ConfirmItemAliasRequest = {
  itemIndex: number;
  selectedItemNo: string;
  selectedItemName: string;
  clientCode: string;
  rawText: string;
};

export type ConfirmItemAliasResponse = ApiResponse<{
  success: true;
}>;

// ==================== list-item-alias ====================

export type ItemAliasEntry = {
  alias: string;
  canonical: string;
  weight: number;
  updated_at: string;
};

export type ListItemAliasResponse = ApiResponse<{
  aliases: ItemAliasEntry[];
}>;

// ==================== delete-item-alias ====================

export type DeleteItemAliasRequest = {
  alias: string;
};

export type DeleteItemAliasResponse = ApiResponse<{
  success: true;
}>;

// ==================== learn-search ====================

export type LearnSearchRequest = {
  query: string;
  selectedItemNo: string;
  selectedItemName: string;
};

export type LearnSearchResponse = ApiResponse<{
  success: true;
}>;
