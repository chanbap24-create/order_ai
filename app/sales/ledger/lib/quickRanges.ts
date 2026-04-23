export function getQuickRanges() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const today = kstNow.toISOString().slice(0, 10);

  const pad = (n: number) => String(n).padStart(2, '0');

  const curStart = `${y}-${pad(m + 1)}-01`;
  const prevStart = m === 0 ? `${y - 1}-12-01` : `${y}-${pad(m)}-01`;
  const prevEnd = new Date(y, m, 0);
  const prevEndStr = `${prevEnd.getFullYear()}-${pad(prevEnd.getMonth() + 1)}-${pad(prevEnd.getDate())}`;

  const q = Math.floor(m / 3);
  const qStartMonth = q * 3 + 1;
  const qStart = `${y}-${pad(qStartMonth)}-01`;

  return [
    { label: '이번 달', start: curStart, end: today },
    { label: '지난 달', start: prevStart, end: prevEndStr },
    { label: '이번 분기', start: qStart, end: today },
    { label: '올해', start: `${y}-01-01`, end: today },
    { label: '작년', start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
    { label: '전체', start: '2020-01-01', end: today },
  ];
}

export function getInitialDateRange() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const firstOfMonth = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const today = kstNow.toISOString().slice(0, 10);
  return { firstOfMonth, today };
}
