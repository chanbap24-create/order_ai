export function formatKrw(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000).toLocaleString()}만`;
  return v.toLocaleString();
}

export function formatDateShort(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
