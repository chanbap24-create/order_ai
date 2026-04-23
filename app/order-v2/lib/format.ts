/** 숫자 포맷 유틸 */

/** 큰 금액 요약 (억/만 단위) */
export function fmtShort(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (n >= 1e6) return (n / 1e4).toFixed(0) + "만";
  return n.toLocaleString();
}

/** 정확한 금액 표시 (천단위 쉼표) */
export function fmt(n: number): string {
  return n.toLocaleString();
}

/** 쉼표 제거 후 숫자 파싱 */
export function parsePrice(text: string): number {
  const n = Number(String(text).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
