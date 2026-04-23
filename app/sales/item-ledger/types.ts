export type Warehouse = 'CDV' | 'DL';
export type ViewMode = 'date' | 'client';

export interface ItemRow {
  ship_date: string;
  client_code: string;
  client_name: string;
  manager: string;
  department: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
}

export interface ClientSummary {
  client_name: string;
  total_qty: number;
  total_amount: number;
  avg_price: number;
  ship_count: number;
  last_date: string;
  first_date: string;
}

export interface SearchItem {
  item_no: string;
  item_name: string;
}

export interface Totals {
  qty: number;
  supply: number;
  clients: number;
}
