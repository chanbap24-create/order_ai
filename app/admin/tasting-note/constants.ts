import type { NoteFilter, TastingWineRow } from "./types";

export const NOTE_FILTERS: NoteFilter[] = ["all", "new", "without", "with", "db-only"];

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

/** (가용 재고 + 보세) 합 */
export function totalStock(w: TastingWineRow): number {
  return (w.inv_available || 0) + (w.inv_bonded || 0);
}

/** 신규로 표기하는 기간 (등록일 기준). 이후엔 신규에서 빠지고 미작성에만 남음. */
export const NEW_WINDOW_DAYS = 7;

/** 등록일이 신규 표기 기간(7일) 이내인지. created_at 없으면 true(차단 안 함). */
export function isWithinNewWindow(w: TastingWineRow): boolean {
  if (!w.created_at) return true;
  const age = Date.now() - new Date(w.created_at).getTime();
  return age <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * "신규(작업 대상)" 판정 — 탭 배지 · 신규 필터 공통 규칙.
 * status='new' · 등록 7일 이내 · 재고합>0 · 노트 미등록 · 제외상태 일치 · (옵션)와인 분류만.
 */
export function isActionableNew(
  w: TastingWineRow,
  hasNote: boolean,
  opts?: { requireWineCategory?: boolean; showExcluded?: boolean },
): boolean {
  if ((opts?.showExcluded ?? false) !== !!w.note_excluded) return false;
  if (w.status !== "new") return false;
  if (!isWithinNewWindow(w)) return false; // 등록 7일 경과 → 신규에서 빠짐(미작성엔 잔류)
  if (totalStock(w) <= 0) return false; // 재고+보세 합 0 → 신규에서 제외
  if (hasNote) return false; // 노트(DB/PDF) 등록되면 신규에서 제외
  if ((opts?.requireWineCategory ?? true) && !isWineCategory(w.item_code)) return false;
  return true;
}

export const NOTE_FILTER_LABELS: Record<NoteFilter, string> = {
  all: "전체",
  new: "신규",
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
