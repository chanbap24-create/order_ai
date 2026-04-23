export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function dayKey(date: string) {
  return date.slice(0, 10);
}

export function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}
