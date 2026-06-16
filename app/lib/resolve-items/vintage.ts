// 품목코드에서 빈티지 추출 (3A24001 → 24 → 2024)
export function getVintageFromItemNo(itemNo: string): number | null {
  const m = String(itemNo).match(/^[A-Z0-9]{2}(\d{2})/i);
  if (!m) return null;
  const yy = Number(m[1]);
  if (yy >= 50) return 1900 + yy;
  return 2000 + yy;
}

// 주문 문장에 빈티지 힌트가 있는지
export function hasVintageHint(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b\d{2}\b/.test(text);
}

// 동점 깨기 + 자동확정(minGap) 넘기기용
export const LATEST_VINTAGE_BOOST = 0.2;

export function extractVintageHint(raw: string): number | null {
  const s = String(raw || "");
  const m4 = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (m4) return Number(m4[1]);

  const m2 = s.match(/(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/);
  if (!m2) return null;

  const yy = Number(m2[1]);
  if (!Number.isFinite(yy)) return null;

  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

// 발주문에 빈티지가 "명시"된 경우만 추출 (4자리 연도 또는 2자리+빈/년 마커).
// 수량("12병","1병")을 빈티지로 오인하지 않도록, 2자리는 빈/년 마커가 있을 때만 인정.
export function extractOrderedVintage(query: string): number | null {
  const s = String(query || "");
  const m4 = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (m4) return Number(m4[1]);
  const m2 = s.match(/(?:^|[^0-9])(\d{2})\s*(?:빈티지|빈|년)/);
  if (m2) {
    const yy = Number(m2[1]);
    return yy >= 50 ? 1900 + yy : 2000 + yy;
  }
  return null;
}

export function codeToVintage(itemNo: string): number | null {
  const code = String(itemNo || "").trim();
  if (code.length < 4) return null;

  const yy = code.slice(2, 4);
  if (!/^\d{2}$/.test(yy)) return null;

  const n = Number(yy);
  if (!Number.isFinite(n)) return null;

  return n >= 50 ? 1900 + n : 2000 + n;
}

export function applyVintageAdjustment(
  baseScore: number,
  hintVintage: number | null,
  itemVintage: number | null,
) {
  if (!hintVintage) return baseScore;
  if (!itemVintage) return baseScore;
  if (hintVintage === itemVintage) return Math.min(1.0, baseScore + 0.08);
  return Math.max(0, baseScore - 0.18);
}
