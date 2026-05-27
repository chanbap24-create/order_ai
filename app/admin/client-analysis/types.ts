export type AnalysisType = 'wine' | 'glass';
export type BizView = 'business' | 'brand';
export type TrendPeriod = 'daily' | 'weekly' | 'monthly';

export interface Filters {
  managers: string[];
  departments: string[];
  businessTypes: string[];
  dateRange: { min: string | null; max: string | null };
}

export interface ClientRankingItem {
  code: string;
  name: string;
  revenue: number;
  quantity: number;
  itemCount: number;
  rankChange: number | null;
  isNew: boolean;
  discountRate: number | null;
}

export interface ManagerAnalysisItem {
  manager: string;
  clientCount: number;
  revenue: number;
  discountRate: number | null;
  brands: Array<{ brand: string; revenue: number }>;
  bizClients: Array<{ biz: string; count: number }>;
}

export interface NamedRevenue {
  name: string;
  revenue: number;
}

export interface TrendPoint {
  date: string;
  revenue: number;
  normal_total: number;
  selling_total: number;
}

export interface AnalysisData {
  summary: {
    totalRevenue: number;
    totalQuantity: number;
    totalCount: number;
    distinctClients: number;
    returnAmount: number;
    positiveRevenue: number;
    top10Pct: number;
    repeatRate: number;
    avgDiscount?: number;
  };
  clientRanking: ClientRankingItem[];
  managerAnalysis: ManagerAnalysisItem[];
  businessAnalysis: NamedRevenue[];
  brandAnalysis: NamedRevenue[];
  dailyTrend: TrendPoint[];
}

export interface ClientDetailItem {
  item_no: string;
  item_name: string;
  quantity: number;
  revenue: number;
  count: number;
  supplyPrice: number | null;
  avgSellingPrice: number | null;
  discountRate: number | null;
}

export interface FilterState {
  manager: string;
  department: string;
  businessType: string;
  clientSearch: string;
  startDate: string;
  endDate: string;
}
