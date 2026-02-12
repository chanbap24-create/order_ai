// app/lib/holidays.ts (Supabase)
import { supabase } from "@/app/lib/db";

type HolidayRow = { ymd: string };

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
  if (!key) {
    console.warn("[holidays] DATA_GO_KR_SERVICE_KEY not set, skipping API fetch");
    return [];
  }

  const out: Array<{ ymd: string; name: string }> = [];

  for (let month = 1; month <= 12; month++) {
    const m = String(month).padStart(2, "0");

    const url =
      `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
      `?serviceKey=${encodeURIComponent(key)}` +
      `&solYear=${year}` +
      `&solMonth=${m}` +
      `&_type=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Holiday API failed: ${res.status} ${res.statusText}`);

    const json: any = await res.json();

    const items = json?.response?.body?.items?.item;
    if (!items) continue;

    const arr = Array.isArray(items) ? items : [items];
    for (const it of arr) {
      const locdate = String(it?.locdate || "");
      const dateName = String(it?.dateName || "");
      if (locdate.length === 8) {
        const ymd = `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`;
        out.push({ ymd, name: dateName });
      }
    }
  }

  const uniq = new Map<string, string>();
  for (const h of out) {
    if (!uniq.has(h.ymd)) uniq.set(h.ymd, h.name);
  }

  return [...uniq.entries()].map(([ymd, name]) => ({ ymd, name }));
}

/** ------------------ DB에 캐시 저장/갱신 ------------------ */
async function loadSetFromDb(year: number) {
  const { data } = await supabase
    .from('holidays')
    .select('ymd')
    .eq('year', year);

  return new Set((data || []).map((r: any) => r.ymd));
}

async function getMeta(year: number) {
  const { data } = await supabase
    .from('holiday_meta')
    .select('fetched_at')
    .eq('year', year)
    .maybeSingle();
  return data as { fetched_at?: string } | undefined;
}

async function setMeta(year: number) {
  await supabase
    .from('holiday_meta')
    .upsert({ year, fetched_at: new Date().toISOString() }, { onConflict: 'year' });
}

async function upsertHolidays(year: number, list: Array<{ ymd: string; name: string }>) {
  await supabase.from('holidays').delete().eq('year', year);

  if (list.length > 0) {
    const rows = list.map(h => ({ ymd: h.ymd, name: h.name, year }));
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('holidays').insert(rows.slice(i, i + 500));
    }
  }

  await setMeta(year);
}

/** ------------------ 공개 API → (1일 TTL) 캐시 보장 ------------------ */
export async function ensureHolidayCache(year?: number) {
  const y = year ?? new Date().getFullYear();

  // 1) 메모리 캐시가 있고, 오늘 fetched이면 그대로 사용
  if (memYear === y && memSet && isMetaFresh(memFetchedAt || "")) return;

  // 2) DB 메타 확인
  const meta = await getMeta(y);
  const fetchedAt = meta?.fetched_at;

  if (isMetaFresh(fetchedAt)) {
    memYear = y;
    memSet = await loadSetFromDb(y);
    memFetchedAt = fetchedAt || null;
    return;
  }

  // 3) DB가 오래됨 → API 호출 → DB 저장 → 메모리 Set 구성
  try {
    const list = await fetchHolidaysFromApi(y);
    if (list.length > 0) {
      await upsertHolidays(y, list);
      memYear = y;
      memSet = new Set(list.map((x) => x.ymd));
      memFetchedAt = todayKST();
    } else {
      // API 키 없거나 결과 없으면 DB 캐시라도 사용
      memYear = y;
      memSet = await loadSetFromDb(y);
      memFetchedAt = null;
    }
  } catch (e) {
    console.error("[holidays] API fetch failed, using DB cache:", e);
    memYear = y;
    memSet = await loadSetFromDb(y);
    memFetchedAt = null;
  }
}

export async function isHolidayKST(d: Date) {
  const y = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getFullYear();
  await ensureHolidayCache(y);

  const set = memSet ?? await loadSetFromDb(y);
  return set.has(ymdKST(d));
}
