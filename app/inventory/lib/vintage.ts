/**
 * 빈티지 포맷 유틸.
 * - 2자리 입력 → 4자리 자동 변환 (50 이상 → 19xx, 미만 → 20xx)
 */
export function normalizeVintage(raw: string | number): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}$/.test(s)) return s;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0 && n <= 99) {
    return n >= 50 ? `19${String(n).padStart(2, "0")}` : `20${String(n).padStart(2, "0")}`;
  }
  return s;
}
