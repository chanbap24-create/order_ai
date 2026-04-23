export type LedgerType = 'wine' | 'glass';

export interface LedgerRow {
  ship_date: string;
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  selling_price: number | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  manager: string;
  warehouse: string;
}

export interface PaymentRow {
  client_code: string;
  client_name: string;
  payment_date: string;
  amount: number;
}

export interface ClientInfo {
  client_code: string;
  client_name: string;
  client_type?: string;
  manager?: string;
  importance?: number;
}

export interface SuggestionItem {
  code: string;
  name: string;
  type?: string;
}

export interface Totals {
  qty: number;
  supply: number;
  tax: number;
  total: number;
  payment: number;
}

export interface DayData {
  date: string;
  rows: LedgerRow[];
  paymentRows: PaymentRow[];
  totals: Totals;
}

export interface MonthData {
  month: string;
  days: DayData[];
  totals: Totals;
}
