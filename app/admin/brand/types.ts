export type ViewMode = "list" | "detail";

export interface LinkedWine {
  item_code: string;
  item_name_kr: string;
  item_name_en: string | null;
  wine_type: string | null;
  vintage: string | null;
  supply_price: number | null;
  available_stock: number | null;
  status: string;
}
