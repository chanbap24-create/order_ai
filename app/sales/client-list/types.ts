export type ListType = 'wine' | 'glass';
export type SortKey = 'client_name' | 'business_type' | 'period_total' | 'period_supply' | 'period_qty' | 'order_days' | 'last_order_date';
export type SortDir = 'asc' | 'desc';

export interface ClientRow {
  client_code: string;
  client_name: string;
  business_type: string;
  period_supply: number;
  period_total: number;
  period_qty: number;
  order_days: number;
  last_order_date: string;
}
