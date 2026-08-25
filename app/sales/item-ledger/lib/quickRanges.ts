import { pad } from './format';

export function getQuickRanges() {
  // KST 고정 — 로컬타임(new Date()) 기준이면 해외/UTC 환경에서 자정 전후 날짜가 틀어짐
  // (ledger 쪽 quickRanges 와 동일 기준으로 통일)
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = `${y}-${pad(m + 1)}-${pad(now.getUTCDate())}`;

  const curStart = `${y}-${pad(m + 1)}-01`;
  const prevStart = m === 0 ? `${y - 1}-12-01` : `${y}-${pad(m)}-01`;
  const prevEnd = new Date(Date.UTC(y, m, 0));
  const prevEndStr = `${prevEnd.getUTCFullYear()}-${pad(prevEnd.getUTCMonth() + 1)}-${pad(prevEnd.getUTCDate())}`;

  const q = Math.floor(m / 3);
  const qStart = `${y}-${pad(q * 3 + 1)}-01`;

  return [
    { label: '이번 달', start: curStart, end: today },
    { label: '지난 달', start: prevStart, end: prevEndStr },
    { label: '이번 분기', start: qStart, end: today },
    { label: '올해', start: `${y}-01-01`, end: today },
    { label: '작년', start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
    { label: '전체', start: '2020-01-01', end: today },
  ];
}

export function getInitialRange() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kstNow.getUTCFullYear();
  const today = kstNow.toISOString().slice(0, 10);
  return { yearStart: `${y}-01-01`, today };
}
