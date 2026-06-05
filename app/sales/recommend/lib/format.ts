export function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

export function scoreColor(score: number): string {
  if (score >= 30) return 'var(--status-danger)';
  if (score >= 20) return 'var(--status-warning)';
  if (score >= 10) return '#f57f17';
  return 'var(--neutral-300)';
}
