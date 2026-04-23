export type SourceMode = 'all' | 'cdv' | 'dl';
export type InvPeriod = 'daily' | 'weekly' | 'monthly';

export interface AnalysisData {
  summary: { totalRevenue: number; totalQuantity: number; totalCount: number };
  brandAnalysis: Array<{ name: string; revenue: number }>;
  countryAnalysis?: Array<{ name: string; revenue: number }>;
  dailyTrend: Array<{ date: string; revenue: number }>;
}

export interface NamedRev { name: string; revenue: number }
export interface NamedVal { name: string; value: number }
