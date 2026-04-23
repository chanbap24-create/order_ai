export const UPLOAD_TYPES = {
  client: {
    label: "거래처별 와인 출고현황",
    description: "Client 시트 - 와인 거래처/품목 데이터",
  },
  "dl-client": {
    label: "거래처별 글라스 출고현황",
    description: "DL-Client 시트 - 글라스 거래처/품목 데이터",
  },
  riedel: {
    label: "리델리스트",
    description: "리델 가격 리스트",
  },
  downloads: {
    label: "와인재고현황",
    description: "와인 재고 현황 데이터",
  },
  dl: {
    label: "글라스재고현황",
    description: "글라스 재고 현황 데이터",
  },
  english: {
    label: "와인리스트",
    description: "와인 영문/한글 가격 리스트",
  },
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;

export function isValidUploadType(type: string): type is UploadType {
  return type in UPLOAD_TYPES;
}

export interface ShipmentRow {
  client_name: string;
  client_code: string;
  ship_date: string | null;
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number | null;
  selling_price: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  business_type: string;
  manager: string;
  department: string;
  warehouse: string;
  shipment_no?: string;
  order_type?: string;
  sales_type?: string;
}

export interface PaymentRow {
  client_code: string;
  client_name: string;
  payment_date: string;
  amount: number;
  manager: string;
  department: string;
}

export interface CarryoverRow {
  client_code: string;
  client_name: string;
  carryover_amount: number;
}
