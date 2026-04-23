import type { Wine } from "@/app/types/wine";

export interface WineWithStatus extends Wine {
  tasting_note_id: number | null;
  ai_generated: number;
  approved: number;
  verification_status: string | null;
  wine_status: "detected" | "researched" | "approved" | "mismatch";
}

export type StatusFilter = "all" | "detected" | "researched" | "approved" | "mismatch";

/** 편집 폼의 키 목록 */
export type EditFormKey =
  | "grape_varieties"
  | "region"
  | "alcohol"
  | "serving_temp"
  | "winery_description"
  | "winemaking"
  | "vintage_note"
  | "color_note"
  | "nose_note"
  | "palate_note"
  | "food_pairing"
  | "glass_pairing"
  | "awards"
  | "aging_potential";

export type EditForm = Record<EditFormKey, string>;
