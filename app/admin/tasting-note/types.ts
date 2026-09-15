import type { Wine } from "@/app/types/wine";

export type NoteFilter = "all" | "new" | "with" | "without" | "db-only" | "dept";

export interface TastingWineRow extends Wine {
  tasting_note_id: number | null;
  verification_status?: string | null;
  inv_available?: number;
  inv_bonded?: number;
  inv_incoming?: number;
  /** ERP 전체 재고(total_stock) — 가용/보세 외 창고(용마 예비·마케팅·특수·위탁 등) 포함 */
  inv_total?: number;
  note_excluded?: boolean | null;
}
