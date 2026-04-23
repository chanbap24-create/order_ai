export function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}
