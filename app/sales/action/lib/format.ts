export function fmt(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

export function importanceStars(imp: number | null): string {
  if (!imp || imp < 1 || imp > 5) return '';
  return '★'.repeat(6 - imp) + '☆'.repeat(imp - 1);
}
