export function formatKrw(v: number | null | undefined) {
  const n = v ?? 0;
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만`;
  return n.toLocaleString();
}

export function formatChangeKrw(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_0000_0000) return `${(abs / 1_0000_0000).toFixed(1)}억`;
  if (abs >= 1_0000) return `${Math.round(abs / 1_0000).toLocaleString()}만`;
  return abs.toLocaleString();
}
