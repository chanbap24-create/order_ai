import type { Wine } from "@/app/types/wine";

export type NoteFilter = "all" | "new" | "with" | "without" | "db-only";

export interface TastingWineRow extends Wine {
  tasting_note_id: number | null;
  verification_status?: string | null;
  inv_available?: number;
  inv_bonded?: number;
  note_excluded?: boolean | null;
}
