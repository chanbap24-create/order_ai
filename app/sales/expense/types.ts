export interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  account_category: string;
  km?: number;
  note?: string;
}

export interface VehicleInfo {
  carNo: string;
  totalKm: number;
  totalLiter: number;
  totalFuel: number;
}

export type SaveStatus = "idle" | "saving" | "saved" | "unsaved";

export interface ParseResult {
  date: string;
  description: string;
  amount: number;
  account_category: string;
  confidence: number;
}

export interface PreviewRow {
  rowNum: number;
  cells: string[];
}
