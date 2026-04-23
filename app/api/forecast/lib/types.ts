export type Shipment = {
  ship_date: string;
  quantity: number;
  item_no: string;
  item_name: string;
  client_name: string;
  manager: string;
  unit_price: number | null;
  selling_price: number | null;
  supply_amount: number | null;
  business_type: string | null;
};

export type WineRow = {
  item_code: string;
  item_name_kr: string;
  supply_price: number | null;
  avg_import_cost: number | null;
  region: string | null;
  grape_varieties: string | null;
  wine_type: string | null;
  country: string | null;
  supplier_kr: string | null;
};

export type WineMapEntry = {
  name: string;
  price: number;
  importCost: number;
  region: string | null;
  grape: string | null;
  type: string | null;
  country: string | null;
  brand: string | null;
};

export type StockoutCorrection = {
  factor: number;
  activeMonths: number;
  totalMonths: number;
  stockoutMonths: number;
};

export type LearningCurve = {
  ratio: number;
  sampleSize: number;
  details: { name: string; year1: number; mature: number; ratio: number }[];
};
