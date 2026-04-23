import type { RegionHierarchy } from './regions';

export interface Candidate {
  item_no: string;
  item_name: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  price: number;
  stock: number;
  hierarchy: RegionHierarchy | null;
}

export interface Alternative {
  item_no: string;
  item_name: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  price: number;
  stock: number;
  match_level: number;
  match_label: string;
  match_reasons: string[];
}
