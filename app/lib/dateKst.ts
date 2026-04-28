/**
 * KST(Asia/Seoul) 기준 날짜 유틸. UTC 환경(Vercel) 에서도 한국 날짜 정확 산출.
 */

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD (KST 기준 오늘) */
export function todayKst(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** YYYY-MM-DD — N일 전 (KST 기준) */
export function daysAgoKst(n: number): string {
  const ms = Date.now() + 9 * 60 * 60 * 1000 - n * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** YYYY-MM (KST 기준 이번 달) */
export function monthKst(): string {
  return todayKst().slice(0, 7);
}
