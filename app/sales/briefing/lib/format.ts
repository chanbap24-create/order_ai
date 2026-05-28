export function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

/** 풀 단위 금액 표시 (3,820,000) — 출고/원장 등 정확한 금액이 필요한 곳에 사용 */
export function fmtFull(n: number) {
  return Math.round(n).toLocaleString();
}

export function getKstToday() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const todayLabel = `${kstNow.getUTCMonth() + 1}월 ${kstNow.getUTCDate()}일`;
  return { todayStr, todayLabel };
}
