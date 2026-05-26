import type { NoteFilter, TastingWineRow } from "./types";

export const NOTE_FILTERS: NoteFilter[] = ["all", "with", "without", "db-only"];

/**
 * item_code 첫 글자별 카테고리 매핑.
 * 와인으로 간주: Champagne(0), Sparkling(1), Red(2), White(3), Rosé(4), Icewine(5), Port(A).
 * 와인 외(자재/세트/타사): Grappa(6), Set(7), POS(8), 자재(9), 타사(Z).
 */
const WINE_CODE_PREFIXES = new Set(['0', '1', '2', '3', '4', '5', 'A']);

export function isWineCategory(itemCode: string | null | undefined): boolean {
  if (!itemCode) return false;
  return WINE_CODE_PREFIXES.has(itemCode.charAt(0).toUpperCase());
}

/** 재고 부족 필터 임계값 (병 수, 0 < x <= LOW_STOCK_THRESHOLD 면 부족) */
export const LOW_STOCK_THRESHOLD = 10;

export const NOTE_FILTER_LABELS: Record<NoteFilter, string> = {
  all: "전체",
  with: "작성완료",
  without: "미작성",
  "db-only": "DB만",
};

export type NoteBadge = { label: string; color: string; bg: string; icon: string };

export function noteBadge(
  w: TastingWineRow,
  ghIndex: Record<string, boolean>,
): NoteBadge {
  const db = !!w.tasting_note_id;
  const gh = !!ghIndex[w.item_code];
  if (db && gh) return { label: "DB+PDF", color: "#16a34a", bg: "#dcfce7", icon: "🟢" };
  if (db) return { label: "DB", color: "#ca8a04", bg: "#fef9c3", icon: "🟡" };
  if (gh) return { label: "PDF", color: "#0ea5e9", bg: "#e0f2fe", icon: "🔵" };
  return { label: "미작성", color: "#9ca3af", bg: "#f3f4f6", icon: "⚪" };
}

export type VerificationBadge = { label: string; color: string; bg: string; title: string };

export function verificationBadge(
  vs: string | null | undefined,
): VerificationBadge | null {
  switch (vs) {
    case "verified":
      return { label: "V", color: "#16a34a", bg: "#dcfce7", title: "검증완료" };
    case "warning":
      return { label: "!", color: "#d97706", bg: "#fef3c7", title: "생산자 확인 필요" };
    case "mismatch":
      return { label: "X", color: "#dc2626", bg: "#fee2e2", title: "생산자 불일치" };
    case "approved":
      return { label: "VV", color: "#2563eb", bg: "#dbeafe", title: "승인완료" };
    case "pending":
      return { label: "?", color: "#9ca3af", bg: "#f3f4f6", title: "검증대기" };
    default:
      return null;
  }
}
