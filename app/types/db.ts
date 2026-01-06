// 데이터베이스 타입 정의

export type ShipmentRow = {
  id: number;
  client_name: string | null;
  client_code: string | null;
  ship_date: string | null;
  item_no: string | null;
  item_name: string | null;
  unit_price: number | null;
};

export type ClientAliasRow = {
  alias: string;
  client_code: string;
  weight: number;
  updated_at: string;
};

export type ClientItemStatsRow = {
  client_code: string;
  item_no: string;
  item_name: string;
  last_ship_date: string | null;
  buy_count: number;
  avg_price: number | null;
};

export type ItemAliasRow = {
  alias: string;
  canonical: string;
  weight: number;
  updated_at: string;
};
