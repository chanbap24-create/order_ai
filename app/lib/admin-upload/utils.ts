export function normCode(x: unknown) {
  return String(x ?? "").trim().replace(/\.0$/, "");
}

export function normText(x: unknown) {
  return String(x ?? "").trim();
}

export function toNumber(x: unknown): number | null {
  if (x == null) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
