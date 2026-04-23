export interface WineRegion {
  id: number;
  country: string;
  major_region: string;
  sub_region: string | null;
  appellation: string | null;
  cru_vineyard: string | null;
  classification: string | null;
  grape_varieties: string | null;
  notes: string | null;
}

export type ViewMode = 'tree' | 'table';

export type RegionTree = Map<string, Map<string, Map<string, WineRegion[]>>>;
