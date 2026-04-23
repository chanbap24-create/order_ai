/** Inventory 숫자/가격 포맷 */

export function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "0";
  return num.toLocaleString("ko-KR");
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null || isNaN(price)) return "-";
  return price > 0 ? `₩${formatNumber(price)}` : "-";
}

export function formatWon(n: number): string {
  if (!n && n !== 0) return "";
  return n.toLocaleString("ko-KR");
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
