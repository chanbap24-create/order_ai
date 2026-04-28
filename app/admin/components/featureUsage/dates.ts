function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function todayKst(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysAgoKst(n: number): string {
  const ms = Date.now() + 9 * 60 * 60 * 1000 - n * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const QUICK_RANGES = [
  { label: '오늘', start: () => todayKst(), end: () => todayKst() },
  { label: '최근 7일', start: () => daysAgoKst(6), end: () => todayKst() },
  { label: '최근 30일', start: () => daysAgoKst(29), end: () => todayKst() },
  { label: '이번 달', start: () => `${todayKst().slice(0, 7)}-01`, end: () => todayKst() },
];

export type UsageRow = {
  usage_date: string;
  manager: string;
  feature: string;
  count: number;
  last_used_at: string;
};

export type UsageApiResp = {
  rows: UsageRow[];
  totals_by_manager: { manager: string; count: number }[];
  totals_by_feature: { feature: string; count: number }[];
  managers: string[];
  features: string[];
  days: string[];
  total_count: number;
};
