import type { VintageSignal } from "./types";

function getVintageFromItemNo(itemNo: string): number | null {
  const m = String(itemNo).match(/^[A-Z0-9]{2}(\d{2})/i);
  if (!m) return null;
  const yy = Number(m[1]);
  if (yy >= 50) return 1900 + yy;
  return 2000 + yy;
}

function extractVintageHint(raw: string): number | null {
  const s = String(raw || "");
  const m4 = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (m4) return Number(m4[1]);

  const m2 = s.match(/(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/);
  if (!m2) return null;

  const yy = Number(m2[1]);
  if (!Number.isFinite(yy)) return null;

  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

export function getVintageSignal(rawInput: string, itemNo: string): VintageSignal {
  const hintVintage = extractVintageHint(rawInput);
  const itemVintage = getVintageFromItemNo(itemNo);

  if (!itemVintage) return { score: 0, itemVintage: null };

  // 빈티지 힌트가 있으면 일치 여부로 가산/감산
  if (hintVintage) {
    if (hintVintage === itemVintage) return { score: 0.08, itemVintage };
    return { score: -0.18, itemVintage };
  }

  // 빈티지 힌트 없으면 최신 빈티지 우선
  const currentYear = new Date().getFullYear();
  const yearDiff = currentYear - itemVintage;

  let score = 0;
  if (yearDiff <= 0) score = 0.20;
  else if (yearDiff === 1) score = 0.15;
  else if (yearDiff === 2) score = 0.10;
  else score = 0.05;

  return { score, itemVintage };
}
