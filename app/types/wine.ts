// 와인 관리 시스템 타입 정의

export interface Wine {
  item_code: string;
  item_name_kr: string;
  item_name_en: string | null;
  country: string | null;
  country_en: string | null;
  region: string | null;
  grape_varieties: string | null;
  wine_type: string | null;
  vintage: string | null;
  volume_ml: number | null;
  alcohol: string | null;
  supplier: string | null;
  supplier_kr: string | null;
  supply_price: number | null;
  available_stock: number | null;
  status: 'active' | 'new' | 'discontinued';
  ai_researched: number; // 0 or 1
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TastingNote {
  id: number;
  wine_id: string;
  color_note: string | null;
  nose_note: string | null;
  palate_note: string | null;
  food_pairing: string | null;
  glass_pairing: string | null;
  serving_temp: string | null;
  awards: string | null;
  winemaking: string | null;
  winery_description: string | null;
  vintage_note: string | null;
  aging_potential: string | null;
  ai_generated: number; // 0 or 1
  manually_edited: number; // 0 or 1
  approved: number; // 0 or 1
  ppt_generated: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface WineImage {
  id: number;
  wine_id: string;
  image_type: string;
  file_path: string;
  created_at: string;
}

export interface PriceHistoryEntry {
  id: number;
  item_code: string;
  field_name: string;
  old_value: number | null;
  new_value: number | null;
  change_pct: number | null;
  detected_at: string;
}

export interface ChangeLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null; // JSON string
  created_at: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface WineResearchResult {
  item_name_en: string;
  country_en: string;
  region: string;
  grape_varieties: string;
  wine_type: string;
  alcohol_percentage: string;
  winemaking: string;
  winery_description: string;
  vintage_note: string;
  aging_potential: string;
  color_note: string;
  nose_note: string;
  palate_note: string;
  food_pairing: string;
  glass_pairing: string;
  serving_temp: string;
  awards: string;
  image_url?: string;
}

export interface DashboardStats {
  totalWines: number;
  newWines: number;
  lowStock: number;
  priceChanges: number;
  tastingNotesComplete: number;
  tastingNotesTotal: number;
  recentChanges: ChangeLogEntry[];
  cdvInventoryValue?: number;
  dlInventoryValue?: number;
}

export type TabId = 'upload' | 'dashboard' | 'new-wine' | 'all-wines' | 'tasting-note' | 'price-list' | 'change-log';
