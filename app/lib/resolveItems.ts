import { db } from "@/app/lib/db";
import { applyItemSynonym } from "@/app/lib/itemsynonyms";
import { getSearchLearningBonuses } from "@/app/lib/searchLearning";
import { calculateWeightedScore, type WeightedScore } from "@/app/lib/weightedScoring";

/* ================= 공통 정규화 ================= */
function normLocal(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,]/g, " ");
}
function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

// ✅ 품목코드에서 빈티지 추출
// 3A24001 → 24 → 2024
export function getVintageFromItemNo(itemNo: string): number | null {
  const m = String(itemNo).match(/^[A-Z0-9]{2}(\d{2})/i);
  if (!m) return null;

  const yy = Number(m[1]);
  if (yy >= 50) return 1900 + yy;
  return 2000 + yy;
}

// ✅ (NEW) 동점 깨기 + 자동확정(minGap) 넘기기용
const LATEST_VINTAGE_BOOST = 0.2;

// ✅ 주문 문장에 빈티지 힌트가 있는지
export function hasVintageHint(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b\d{2}\b/.test(text);
}

/* ================= 수량/단위 제거(품목 문자열만) ================= */
function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/* ================= 테이블 유틸: 존재 확인/탐색 ================= */
function tableExists(name: string) {
  const r = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(name) as any;
  return !!r;
}

function pickMasterTable(): string | null {
  // ✅ 프로젝트마다 다를 수 있어 후보를 여러 개 둠
  const candidates = [
    "items",
    "item_master",
    "item_mst",
    "sku_master",
    "product_master",
    "products",
    "inventory_items",
    "downloads_items",
    "Downloads_items",
  ];
  for (const t of candidates) if (tableExists(t)) return t;
  return null;
}

function detectColumns(table: string): { itemNo: string; itemName: string } | null {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    const names = cols.map((c) => String(c.name));

    const itemNo =
      names.find((n) => ["item_no", "itemNo", "sku", "code", "품목번호", "품목코드"].includes(n)) ||
      names.find((n) => n.toLowerCase().includes("item") && n.toLowerCase().includes("no")) ||
      names.find((n) => n.toLowerCase().includes("code")) ||
      null;

    const itemName =
      names.find((n) => ["item_name", "itemName", "name", "품목명"].includes(n)) ||
      names.find((n) => n.toLowerCase().includes("item") && n.toLowerCase().includes("name")) ||
      names.find((n) => n.toLowerCase().includes("name")) ||
      null;

    if (!itemNo || !itemName) return null;
    return { itemNo, itemName };
  } catch {
    return null;
  }
}

/* ================= (NEW) 뒤에서 토큰 뽑아 마스터에서 후보 확장 ================= */
function getTailTokens(rawName: string) {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));

  // 뒤에서 1~2개
  const tail1 = clean[clean.length - 1];
  const tail2 = clean[clean.length - 2];
  const out: string[] = [];
  if (tail1) out.push(tail1);
  if (tail2) out.push(tail2);
  return out;
}

function fetchFromMasterByTail(rawName: string, limit = 60) {
  const table = pickMasterTable();
  if (!table) return [] as Array<{ item_no: string; item_name: string }>;

  const cols = detectColumns(table);
  if (!cols) return [] as Array<{ item_no: string; item_name: string }>;

  const tails = getTailTokens(rawName);
  if (tails.length === 0) return [] as Array<{ item_no: string; item_name: string }>;

  // LIKE 검색(뒤 토큰 기반) — 너무 많이 안 뽑히게 limit 적용
  const where = tails.map(() => `${cols.itemName} LIKE ?`).join(" OR ");
  const params = tails.map((t) => `%${t}%`);

  try {
    const sql = `
      SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
      FROM ${table}
      WHERE ${where}
      LIMIT ${limit}
    `;
    return db.prepare(sql).all(...params) as Array<{ item_no: string; item_name: string }>;
  } catch {
    return [] as Array<{ item_no: string; item_name: string }>;
  }
}

/* ================= UI 학습(alias) 테이블 ================= */
function ensureItemAliasTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_alias (
      alias TEXT PRIMARY KEY,
      canonical TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

type AliasRow = { alias: string; canonical: string };

// ✅ (중요) contains_specific 기준을 빡세게
// - 토큰 >= 3 또는 tightLen >= 12 일 때만 “구체”로 인정 (상위 alias 방지)
function isSpecificAlias(alias: string) {
  const a = stripQtyAndUnit(alias);
  const tokens = a.split(" ").filter(Boolean);
  const tightLen = normTight(a).length;
  return tokens.length >= 3 || tightLen >= 12;
}

type LearnedMatch =
  | { kind: "exact"; alias: string; canonical: string }
  | { kind: "contains_specific"; alias: string; canonical: string }
  | { kind: "contains_weak"; alias: string; canonical: string }
  | null;

function getLearnedMatch(rawInput: string): LearnedMatch {
  ensureItemAliasTable();

  const inputItem = stripQtyAndUnit(rawInput);
  const nInputItem = normTight(inputItem);

  const rows = db.prepare(`SELECT alias, canonical FROM item_alias`).all() as AliasRow[];
  if (!rows?.length) return null;

  const pairs = rows
    .map((r) => {
      const aliasItem = stripQtyAndUnit(r.alias);
      return {
        aliasItem,
        nAliasItem: normTight(aliasItem),
        canonical: String(r.canonical || "").trim(),
      };
    })
    .filter((x) => x.nAliasItem && x.canonical)
    .sort((a, b) => b.nAliasItem.length - a.nAliasItem.length);

  // 1) Exact 우선
  for (const p of pairs) {
    if (p.nAliasItem === nInputItem) {
      return { kind: "exact", alias: p.aliasItem, canonical: p.canonical };
    }
  }

  // 2) Contains
  for (const p of pairs) {
    if (nInputItem.includes(p.nAliasItem)) {
      if (isSpecificAlias(p.aliasItem)) {
        return { kind: "contains_specific", alias: p.aliasItem, canonical: p.canonical };
      } else {
        return { kind: "contains_weak", alias: p.aliasItem, canonical: p.canonical };
      }
    }
  }

  return null;
}

/* ================= 품목명 정규화 ================= */
function normalizeItemName(s: string) {
  let t = String(s || "").toLowerCase();
  t = t.replace(/\s+/g, " ").trim();

  // Sauvignon Blanc (소비뇽 블랑)
  t = t.replace(/\bsauvignon\s+blanc\b/gi, "소비뇽블랑");
  t = t.replace(/\bsauv\s*blanc\b/gi, "소비뇽블랑");
  t = t.replace(/\bs\.?\s*b\.?\b/gi, "소비뇽블랑");
  t = t.replace(/\bsauvignon\b/gi, "소비뇽");

  // Cabernet Sauvignon
  t = t.replace(/\bcabernet\s+sauvignon\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcab\s*sauv\b/gi, "카베르네소비뇽");
  t = t.replace(/\bc\/s\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcabernet\b/gi, "카베르네");
  t = t.replace(/\bcab\b/gi, "카베르네소비뇽");

  // cs / cs1 / cs 1
  t = t.replace(/\bcs\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcs(?=\s*\d)/gi, "카베르네소비뇽");

  // Chardonnay
  t = t.replace(/\bchardonnay\b/gi, "샤르도네");
  t = t.replace(/\bchard\b/gi, "샤르도네");
  t = t.replace(/샤도네이|샤도네|샤도/g, "샤르도네");

  // Pinot Noir
  t = t.replace(/\bpinot\s+noir\b/gi, "피노누아");
  t = t.replace(/\bp\.?\s*n\.?\b/gi, "피노누아");

  // Merlot
  t = t.replace(/\bmerlot\b/gi, "메를로");

  // Riesling
  t = t.replace(/\briesling\b/gi, "리슬링");

  // 일반 와인 용어
  t = t.replace(/\bblanc\b/gi, "블랑");
  t = t.replace(/\bred\b/gi, "레드");
  t = t.replace(/\bwhite\b/gi, "화이트");
  t = t.replace(/\brose\b/gi, "로제");

  // 주요 브랜드명
  t = t.replace(/\blake\s+chalice\b/gi, "레이크찰리스");
  t = t.replace(/\bthe\s+nest\b/gi, "네스트");
  t = t.replace(/\banselmi\b/gi, "안셀미");
  t = t.replace(/\bsan\s+vincenzo\b/gi, "산빈센죠");
  t = t.replace(/\bveneto\b/gi, "베네토");

  return t;
}

function norm(s: string) {
  return normalizeItemName(s)
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

/* ================= 빈티지 힌트 ================= */
function extractVintageHint(raw: string): number | null {
  const s = String(raw || "");
  const m4 = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (m4) return Number(m4[1]);

  const m2 = s.match(/(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/);
  if (!m2) return null;

  const yy = Number(m2[1]);
  if (!Number.isFinite(yy)) return null;

  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

function codeToVintage(itemNo: string): number | null {
  const code = String(itemNo || "").trim();
  if (code.length < 4) return null;

  const yy = code.slice(2, 4);
  if (!/^\d{2}$/.test(yy)) return null;

  const n = Number(yy);
  if (!Number.isFinite(n)) return null;

  return n >= 50 ? 1900 + n : 2000 + n;
}

function applyVintageAdjustment(baseScore: number, hintVintage: number | null, itemVintage: number | null) {
  if (!hintVintage) return baseScore;
  if (!itemVintage) return baseScore;
  if (hintVintage === itemVintage) return Math.min(1.0, baseScore + 0.08);
  return Math.max(0, baseScore - 0.18);
}

/* ================= 점수 ================= */
function scoreItem(q: string, name: string) {
  const a = norm(q);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.9;

  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  return Math.min(0.89, common / Math.max(6, a.length));
}

/* =======================================================================
   (ADD) 최근 출고일 우선: Client 시트/테이블 자동 탐지 + item_no별 MAX(출고일)
   - 못 찾으면 빈 맵 반환 → 기존 로직 영향 0
   ======================================================================= */
function pickClientShipTable(): string | null {
  const candidates = [
    "Client",
    "client",
    "client_rows",
    "client_history",
    "client_shipments",
    "client_sales",
    "client_item_history",
    "client_item_rows",
    "sales_client",
    "sales",
  ];
  for (const t of candidates) if (tableExists(t)) return t;
  return null;
}

function detectClientShipColumns(table: string): { clientCode: string; itemNo: string; shippedAt: string } | null {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    const names = cols.map((c) => String(c.name));

    const clientCode =
      names.find((n) => ["client_code", "clientCode", "거래처코드", "F"].includes(n)) ||
      names.find((n) => n.toLowerCase().includes("client") && n.toLowerCase().includes("code")) ||
      null;

    const itemNo =
      names.find((n) => ["item_no", "itemNo", "품목번호", "품목코드", "sku", "code", "M"].includes(n)) ||
      names.find((n) => n.toLowerCase().includes("item") && n.toLowerCase().includes("no")) ||
      names.find((n) => n.toLowerCase().includes("sku")) ||
      null;

    const shippedAt =
      names.find((n) => ["shipped_at", "ship_date", "out_date", "출고일", "출고일자", "date", "G"].includes(n)) ||
      names.find((n) => n.includes("출고")) ||
      names.find((n) => n.toLowerCase().includes("ship") && n.toLowerCase().includes("date")) ||
      null;

    if (!clientCode || !itemNo || !shippedAt) return null;
    return { clientCode, itemNo, shippedAt };
  } catch {
    return null;
  }
}

function buildLastShippedMap(clientCode: string) {
  const map = new Map<string, number>();

  const table = pickClientShipTable();
  if (!table) return map;

  const cols = detectClientShipColumns(table);
  if (!cols) return map;

  try {
    const sql = `
      SELECT ${cols.itemNo} AS item_no, MAX(${cols.shippedAt}) AS last_shipped_at
      FROM ${table}
      WHERE ${cols.clientCode} = ?
      GROUP BY ${cols.itemNo}
    `;
    const rows = db.prepare(sql).all(clientCode) as Array<{ item_no: any; last_shipped_at: any }>;

    for (const r of rows) {
      const itemNo = String(r.item_no || "").trim();
      if (!itemNo) continue;
      const t = new Date(String(r.last_shipped_at || "")).getTime();
      if (Number.isFinite(t) && t > 0) map.set(itemNo, t);
    }
  } catch {
    return map;
  }

  return map;
}

/* ================= 메인 ================= */
export function resolveItemsByClient(
  clientCode: string,
  items: Array<{ name: string; qty: number }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
) {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 5;

  // 거래처 이력 후보
  const clientRows = db
    .prepare(
      `SELECT item_no, item_name
       FROM client_item_stats
       WHERE client_code = ?`
    )
    .all(clientCode) as Array<{ item_no: string; item_name: string }>;

  // (ADD) 최근 출고일 맵: 1회만 생성(성능)
  const lastShippedMap = buildLastShippedMap(clientCode);

  // ===========================
  // (ADD-EN) English 시트 동기화된 영문명 맵 로드 (item_no -> name_en)
  // ===========================
  function loadEnglishMap() {
    try {
      const rows = db.prepare(`SELECT item_no, name_en FROM item_english`).all() as any[];
      const m = new Map<string, string>();
      for (const r of rows) {
        const k = String(r.item_no ?? "").trim();
        const v = String(r.name_en ?? "").trim();
        if (k && v) m.set(k, v);
      }
      return m;
    } catch {
      return new Map<string, string>();
    }
  }
  const englishMap = loadEnglishMap();


  return items.map((it) => {
    const vintageHint = extractVintageHint(it.name);
    const learned = getLearnedMatch(it.name);

    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // ✅ 마스터 후보(뒤 토큰으로 추가 조회)
    const masterRows = fetchFromMasterByTail(it.name, 80);

    // ✅ 후보 풀 = 거래처이력 + 마스터 (중복 제거)
    const poolMap = new Map<string, { item_no: string; item_name: string }>();
    for (const r of clientRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of masterRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    const pool = Array.from(poolMap.values());

    // 1) Exact 학습이면 하드 확정
    if (learned && learned.kind === "exact" && learnedItemNo) {
      const hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        return {
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(it.name)),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 1.0,
          method: "alias_exact_item_no",
          candidates: [],
          suggestions: [],
        };
      }
    }

    // 2) contains_specific 학습이면 하드 확정 (✅ 기준 빡세게 적용됨)
    if (learned && learned.kind === "contains_specific" && learnedItemNo) {
      const hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        return {
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(it.name)),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 0.99,
          method: "alias_contains_specific_item_no",
          candidates: [],
          suggestions: [],
        };
      }
    }

    // 3) 점수 기반 + contains_weak는 소프트 가산점만
    const synonymApplied = applyItemSynonym(it.name);
    const q = normalizeItemName(synonymApplied);
    const SOFT_BONUS = 0.15;

    // ✅ (NEW) 검색 학습 보너스: 후보 클릭 누적 기반 가산점
    const learnedBonuses = getSearchLearningBonuses(it.name, 30);
    const bonusMap = new Map<string, number>();
    for (const b of learnedBonuses) bonusMap.set(String(b.item_no), b.bonus);

    // ✅ scored는 "let"으로(동점 깨기 블록에서 재정렬/수정)
    let scored = pool
      .map((r) => {
        const ko = scoreItem(q, r.item_name);

        const enName = englishMap.get(String(r.item_no)) || "";
        const en = enName ? scoreItem(q, enName) : 0;

        // 한글/영문 중 더 잘 맞는 것을 base로 사용
        const base = Math.max(ko, en);

        const itemVintage = codeToVintage(r.item_no);
        let finalScore = applyVintageAdjustment(base, vintageHint, itemVintage);

        if (learned && learned.kind === "contains_weak" && learnedItemNo) {
          if (String(r.item_no) === learnedItemNo) {
            finalScore = Math.min(1.0, finalScore + SOFT_BONUS);
          }
        }

        // ===========================
        // (ADD-1) search_learning 보너스 반영 (기존 로직 유지 + 가산만)
        // ===========================
        const learnedBonus = bonusMap.get(String(r.item_no)) ?? 0;
        if (learnedBonus > 0) {
          finalScore = Math.min(1.0, finalScore + learnedBonus);
        }

        // ===========================
        // (ADD-2) 최근 출고일 우선 + 최근 빈티지 우선 (fallback)
        // - 빈티지 힌트가 없을 때만 가산
        // ===========================
        if (!hasVintageHint(it.name)) {
          // 1) 최근 출고일 우선 (있으면 최근일수록 가산, 상한 +0.05)
          const shippedAt = lastShippedMap.get(String(r.item_no));
          if (shippedAt) {
            const daysAgo = (Date.now() - shippedAt) / (1000 * 60 * 60 * 24);
            const shipBonus = Math.max(0, 0.05 - daysAgo * 0.0005);
            if (shipBonus > 0) finalScore = Math.min(1.0, finalScore + shipBonus);
          }

          // 2) 최근 빈티지 우선 fallback (항상 동작)
          const v = getVintageFromItemNo(r.item_no);
          if (v) {
            // 2025 → +0.05 / 2024 → +0.048 정도 (상한 0.05)
            const vBonus = Math.min(0.05, (v - 2000) * 0.002);
            if (vBonus > 0) finalScore = Math.min(1.0, finalScore + vBonus);
          }
        }

        return { item_no: r.item_no, item_name: r.item_name, score: finalScore };
      })
      .sort((a, b) => b.score - a.score);

    // ===========================
    // (ADD-3) "같은 품목명 + 빈티지만 다름" 동점 깨기
    // - 빈티지 힌트가 없을 때만
    // - 상위 N개에서 top과 동일한 이름 그룹만 대상으로 최신 빈티지에 +0.20
    // ===========================
    if (!hasVintageHint(it.name) && scored.length >= 2) {
      const N = Math.min(10, scored.length);
      const topNArr = scored.slice(0, N);

      const key = norm(topNArr[0]?.item_name || "");
      if (key) {
        const sameGroup = topNArr.filter((c) => norm(c.item_name) === key);

        if (sameGroup.length >= 2) {
          let maxV = -1;
          for (const c of sameGroup) {
            const v = getVintageFromItemNo(c.item_no) ?? codeToVintage(c.item_no) ?? -1;
            if (v > maxV) maxV = v;
          }

          if (maxV > 0) {
            const boostedTopN = topNArr.map((c) => {
              const v = getVintageFromItemNo(c.item_no) ?? codeToVintage(c.item_no) ?? -1;
              if (norm(c.item_name) === key && v === maxV) {
                return { ...c, score: Math.min(1.0, c.score + LATEST_VINTAGE_BOOST) };
              }
              return c;
            });

            scored = [...boostedTopN, ...scored.slice(N)].sort((a, b) => b.score - a.score);
          }
        }
      }
    }

    let top = scored[0];
    let second = scored[1];

    // ✅ contains_weak + 토큰이 3개 이상이면 자동확정 보수적으로
    const tokenCount = stripQtyAndUnit(it.name).split(" ").filter(Boolean).length;

    // ✅ 1) 기본 자동확정 조건
    let resolved =
      !!top && top.score >= minScore && (!second || top.score - second.score >= minGap);

    // ===========================
    // ✅ (FIX) 최신 빈티지 tie-break 자동확정
    // - "같은 품목명(빈티지만 다름)" 인데 gap이 작아서 확정이 안 되는 케이스 해결
    // - 주문에 빈티지 힌트가 없을 때만 적용
    // - top/second가 같은 그룹이면 더 최신 빈티지를 top으로 스왑 후 resolved = true
    // ===========================
    if (!hasVintageHint(it.name) && !resolved && top && second) {
      // 같은 그룹 판정: 기존 norm() 재사용 (공백/기호 제거된 형태)
      const k1 = norm(String(top.item_name || ""));
      const k2 = norm(String(second.item_name || ""));
      const sameGroup = k1 && k2 && k1 === k2;

      if (sameGroup) {
        const v1 = getVintageFromItemNo(String(top.item_no)) ?? codeToVintage(String(top.item_no));
        const v2 = getVintageFromItemNo(String(second.item_no)) ?? codeToVintage(String(second.item_no));

        // second가 더 최신이면 top으로 올림
        if (v1 && v2 && v2 > v1) {
          const tmp = top;
          top = second;
          second = tmp;
        }

        // 최신 빈티지를 top으로 만들었으면 gap 무시하고 자동확정
        // (단, minScore는 통과해야 함)
        if (top.score >= minScore) {
          resolved = true;
        }
      }
    }

    // ✅ contains_weak + 토큰 3개 이상은 원칙적으로 자동확정 금지
    // ✅ 단, topScore>=0.88 AND (top-second)>=0.30 이면 예외적으로 자동확정 허용
    if (learned?.kind === "contains_weak" && tokenCount >= 3) {
      const gap = second ? top.score - second.score : 1.0;
      const allowAuto = top.score >= 0.88 && gap >= 0.30;
      if (!allowAuto) {
        resolved = false;
      }
    }



    if (resolved) {
      return {
        ...it,
        normalized_query: q,
        resolved: true,
        item_no: top.item_no,
        item_name: top.item_name,
        score: Number(top.score.toFixed(3)),
        method: learned?.kind ? `match+${learned.kind}` : "match",

        candidates: scored.slice(0, topN).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
        })),
        suggestions: scored.slice(0, Math.max(3, topN)).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
        })),

      };
    }

    return {
      ...it,
      normalized_query: q,
      resolved: false,
      candidates: scored.slice(0, topN).map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
      })),
      suggestions: scored.slice(0, Math.max(3, topN)).map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
      })),
    };
  });
}
