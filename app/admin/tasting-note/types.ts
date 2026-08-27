import type { Wine } from "@/app/types/wine";

export type NoteFilter = "all" | "new" | "with" | "without" | "db-only" | "dept";

export interface TastingWineRow extends Wine {
  tasting_note_id: number | null;
  verification_status?: string | null;
  inv_available?: number;
  inv_bonded?: number;
  inv_incoming?: number;
  note_excluded?: boolean | null;
}
