// app/lib/holidays.ts
import { db } from "@/app/lib/db";

type HolidayRow = { ymd: string };

function ensureHolidayTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS holidays (
      ymd TEXT PRIMARY KEY,          -- "YYYY-MM-DD"
      name TEXT,
      year INTEGER,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS holiday_meta (
      year INTEGER PRIMARY KEY,
      fetched_at TEXT
    )
  `).run();
}

function ymdKST(d: Date) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const day = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKST() {
  return ymdKST(new Date());
}

function isMetaFresh(fetchedAt: string | null | undefined) {
  if (!fetchedAt) return false;
  // fetched_at이 오늘(KST)이면 fresh로 간주
  const f = fetchedAt.slice(0, 10);
  return f === todayKST();
}

/** ------------------ 메모리 캐시 ------------------ */
let memYear: number | null = null;
let memSet: Set<string> | null = null;
let memFetchedAt: string | null = null;

/** ------------------ 공휴일 API 호출 ------------------ */
async function fetchHolidaysFromApi(year: number): Promise<Array<{ ymd: string; name: string }>> {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) throw new Error("DATA_GO_KR_SERVICE_KEY missing in .env.local");

  // 공공데이터 API는 보통 월별로 많이 씀. (1~12월)
  const out: Array<{ ymd: string; name: string }> = [];

  for (let month = 1; month <= 12; month++) {
    const m = String(month).padStart(2, "0");

    // NOTE: endpoint는 사용 중인 서비스키/형식에 따라 다를 수 있음.
    // 여기서는 json 응답 가정. (dev에서 응답 확인 후 필요 시 조정)
    const url =
      `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
      `?serviceKey=${encodeURIComponent(key)}` +
      `&solYear=${year}` +
      `&solMonth=${m}` +
      `&_type=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Holiday API failed: ${res.status} ${res.statusText}`);

    const json: any = await res.json();

    // items가 단일 객체 or 배열일 수 있음
    const items = json?.response?.body?.items?.item;
    if (!items) continue;

    const arr = Array.isArray(items) ? items : [items];
    for (const it of arr) {
      const locdate = String(it?.locdate || ""); // 예: "20251225"
      const dateName = String(it?.dateName || "");
      if (locdate.length === 8) {
        const ymd = `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`;
        out.push({ ymd, name: dateName });
      }
    }
  }

  // 중복 제거
  const uniq = new Map<string, string>();
  for (const h of out) {
    if (!uniq.has(h.ymd)) uniq.set(h.ymd, h.name);
  }

  return [...uniq.entries()].map(([ymd, name]) => ({ ymd, name }));
}

/** ------------------ DB에 캐시 저장/갱신 ------------------ */
function loadSetFromDb(year: number) {
  ensureHolidayTable();

  const rows = db
    .prepare(`SELECT ymd FROM holidays WHERE year = ?`)
    .all(year) as HolidayRow[];

  return new Set(rows.map((r) => r.ymd));
}

function getMeta(year: number) {
  ensureHolidayTable();
  return db
    .prepare(`SELECT fetched_at FROM holiday_meta WHERE year = ?`)
    .get(year) as { fetched_at?: string } | undefined;
}

function setMeta(year: number) {
  ensureHolidayTable();
  db.prepare(
    `INSERT INTO holiday_meta(year, fetched_at)
     VALUES (?, CURRENT_TIMESTAMP)
     ON CONFLICT(year) DO UPDATE SET fetched_at = CURRENT_TIMESTAMP`
  ).run(year);
}

function upsertHolidays(year: number, list: Array<{ ymd: string; name: string }>) {
  ensureHolidayTable();

  const del = db.prepare(`DELETE FROM holidays WHERE year = ?`);
  del.run(year);

  const ins = db.prepare(`INSERT INTO holidays(ymd, name, year) VALUES (?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const h of list) ins.run(h.ymd, h.name, year);
  });
  tx();

  setMeta(year);
}

/** ------------------ 공개 API → (1일 TTL) 캐시 보장 ------------------ */
export async function ensureHolidayCache(year?: number) {
  const y = year ?? new Date().getFullYear();
  ensureHolidayTable();

  // 1) 메모리 캐시가 있고, 오늘 fetched이면 그대로 사용
  if (memYear === y && memSet && isMetaFresh(memFetchedAt || "")) return;

  // 2) DB 메타 확인
  const meta = getMeta(y);
  const fetchedAt = meta?.fetched_at;

  if (isMetaFresh(fetchedAt)) {
    // DB가 오늘 기준 최신 → DB에서 Set 로드 → 메모리에 올림
    memYear = y;
    memSet = loadSetFromDb(y);
    memFetchedAt = fetchedAt || null;
    return;
  }

  // 3) DB가 오래됨 → API 호출 → DB 저장 → 메모리 Set 구성
  const list = await fetchHolidaysFromApi(y);
  upsertHolidays(y, list);

  memYear = y;
  memSet = new Set(list.map((x) => x.ymd));
  memFetchedAt = todayKST(); // 오늘로 마킹
}

export async function isHolidayKST(d: Date) {
  const y = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getFullYear();
  await ensureHolidayCache(y);

  const set = memSet ?? loadSetFromDb(y);
  return set.has(ymdKST(d));
}
