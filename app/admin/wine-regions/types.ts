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

/** 각 산지 노드에 매핑된 "우리 와인(테이스팅노트 보유)" 수 */
export interface RegionWineCounts {
  total: number;
  matched: number;
  unmatched: number;
  noRegion: number;
  byCountry: Record<string, number>;   // key: country
  byMajor: Record<string, number>;     // key: `${country}>${major_region}`
  bySub: Record<string, number>;       // key: `${country}>${major_region}>${sub_region}`
  unmatchedSamples: string[];
}
