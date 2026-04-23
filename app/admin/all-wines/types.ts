import type { Wine } from '@/app/types/wine';

export interface WineRow extends Wine {
  tasting_note_id: number | null;
  ai_generated: number;
  approved: number;
}

export interface WineRowExt extends WineRow {
  bonded_stock: number | null;
}

export interface CountryOption {
  name: string;
  cnt: number;
}

export interface WineListFilters {
  search: string;
  country: string;
  statusFilter: string;
  hideZero: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
}
