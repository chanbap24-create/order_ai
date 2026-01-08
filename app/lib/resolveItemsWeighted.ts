/**
 * ========================================
 * 조합 가중치 기반 품목 매칭 시스템
 * ========================================
 * 
 * resolveItems.ts의 가중치 시스템 버전
 * 여러 신호를 종합해서 정교한 매칭 수행
 */

import { db } from "@/app/lib/db";
import { applyItemSynonym } from "@/app/lib/itemsynonyms";
import { calculateWeightedScore } from "@/app/lib/weightedScoring";

/* ================= 정규화 함수 ================= */

function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/* ================= 품목명 정규화 ================= */

function normalizeItemName(s: string) {
  let t = String(s || "").toLowerCase();
  t = t.replace(/\s+/g, " ").trim();

  // Sauvignon Blanc
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

  return t;
}

function norm(s: string) {
  return normalizeItemName(s)
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

/* ================= 빈티지 힌트 ================= */

export function hasVintageHint(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b\d{2}\b/.test(text);
}

/* ================= 점수 계산 ================= */

function scoreItem(q: string, name: string) {
  // 영문 단어 매칭 우선 (3글자 이상 영어 단어가 있으면)
  const qEnglishWords = (q.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());
  const nameEnglishWords = (name.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());
  
  if (qEnglishWords.length >= 2 && nameEnglishWords.length >= 2) {
    const qSet = new Set(qEnglishWords);
    const nameSet = new Set(nameEnglishWords);
    const intersection = [...qSet].filter(w => nameSet.has(w));
    
    // 3개 이상 매칭되면 높은 점수
    if (intersection.length >= 3) {
      const recall = intersection.length / qSet.size; // 입력 단어 중 매칭 비율
      const precision = intersection.length / nameSet.size; // 대상 단어 중 매칭 비율
      return Math.min(0.95, (recall + precision) / 2 + 0.2);
    }
    // 2개 이상 매칭
    if (intersection.length >= 2) {
      const recall = intersection.length / qSet.size;
      return Math.min(0.85, recall + 0.3);
    }
  }
  
  // 기존 한글 정규화 로직
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

/* ================= 테이블 유틸 ================= */

function tableExists(name: string) {
  const r = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(name) as any;
  return !!r;
}

function pickMasterTable(): string | null {
  const candidates = [
    "items", "item_master", "item_mst", "sku_master", "product_master",
    "products", "inventory_items", "downloads_items", "Downloads_items",
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

/* ================= 마스터에서 후보 확장 ================= */

function getTailTokens(rawName: string) {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));

  const tail1 = clean[clean.length - 1];
  const tail2 = clean[clean.length - 2];
  const out: string[] = [];
  if (tail1) out.push(tail1);
  if (tail2) out.push(tail2);
  return out;
}

function fetchFromMasterByTail(rawName: string, limit = 80) {
  const table = pickMasterTable();
  if (!table) return [] as Array<{ item_no: string; item_name: string }>;

  const cols = detectColumns(table);
  if (!cols) return [] as Array<{ item_no: string; item_name: string }>;

  const tails = getTailTokens(rawName);
  if (tails.length === 0) return [] as Array<{ item_no: string; item_name: string }>;

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

/* ================= 영문명 맵 로드 ================= */

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

/* ================= UI 학습 체크 (Exact 자동확정용) ================= */

type AliasRow = { alias: string; canonical: string };

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
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS item_alias (
        alias TEXT PRIMARY KEY,
        canonical TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch {
    // 테이블 이미 존재
  }

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

/* ================= 메인 함수 ================= */

export interface ResolvedItem {
  name: string;
  qty: number;
  normalized_query: string;
  resolved: boolean;
  item_no?: string;
  item_name?: string;
  score?: number;
  method?: string;
  candidates: Array<{
    item_no: string;
    item_name: string;
    score: number;
    _debug?: any; // 디버그 정보
  }>;
  suggestions: Array<{
    item_no: string;
    item_name: string;
    score: number;
  }>;
}

export function resolveItemsByClientWeighted(
  clientCode: string,
  items: Array<{ name: string; qty: number }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
): ResolvedItem[] {
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

  // 영문명 맵
  const englishMap = loadEnglishMap();

  return items.map((it) => {
    const learned = getLearnedMatch(it.name);
    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // 마스터 후보
    const masterRows = fetchFromMasterByTail(it.name, 80);

    // ✅ 영문명으로도 검색 (Christophe Pitois 같은 케이스 대응)
    const englishRows: Array<{ item_no: string; item_name: string }> = [];
    const hasEnglish = /[A-Za-z]{3,}/.test(it.name);
    if (hasEnglish) {
      try {
        const words = it.name.match(/[A-Za-z]{3,}/g) || [];
        const searchPatterns: string[] = [];
        for (const word of words) {
          searchPatterns.push(`%${word.toLowerCase()}%`);
        }
        const allCandidates = new Map<string, { item_no: string; item_name: string }>();
        for (const pattern of searchPatterns.slice(0, 5)) {
          const rows = db.prepare(`
            SELECT ie.item_no, cis.item_name, ie.name_en
            FROM item_english ie
            LEFT JOIN client_item_stats cis ON ie.item_no = cis.item_no AND cis.client_code = ?
            WHERE LOWER(ie.name_en) LIKE ?
            LIMIT 20
          `).all(clientCode, pattern) as any[];
          for (const r of rows) {
            if (r.item_no) {
              // 거래처 이력이 있으면 그 한글명 사용, 없으면 영문명 사용
              const displayName = r.item_name || r.name_en;
              allCandidates.set(String(r.item_no), { item_no: String(r.item_no), item_name: displayName });
            }
          }
        }
        englishRows.push(...Array.from(allCandidates.values()));
      } catch (e) {
        console.error('[resolveItemsWeighted] English search failed:', e);
      }
    }

    // 후보 풀 = 거래처이력 + 마스터 + 영문명 (중복 제거)
    const poolMap = new Map<string, { item_no: string; item_name: string }>();
    for (const r of clientRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of masterRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of englishRows) {
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

    // 2) contains_specific 학습이면 하드 확정
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

    // 3) 🎯 조합 가중치 시스템으로 점수 계산
    const synonymApplied = applyItemSynonym(it.name);
    const q = normalizeItemName(synonymApplied);

    const scored = pool
      .map((r) => {
        const ko = scoreItem(q, r.item_name);
        const enName = englishMap.get(String(r.item_no)) || "";
        const en = enName ? scoreItem(q, enName) : 0;
        const baseScore = Math.max(ko, en);

        // 🎯 가중치 시스템으로 최종 점수 계산
        const weighted = calculateWeightedScore(
          it.name,
          clientCode,
          String(r.item_no),
          baseScore
        );

        return {
          item_no: r.item_no,
          item_name: r.item_name,
          score: weighted.finalScore,
          _debug: {
            baseScore: weighted.signals.baseScore,
            userLearning: weighted.signals.userLearning,
            recentPurchase: weighted.signals.recentPurchase,
            purchaseFrequency: weighted.signals.purchaseFrequency,
            vintage: weighted.signals.vintage,
            weights: weighted.weights,
            rawTotal: weighted.rawTotal,
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    const top = scored[0];
    const second = scored[1];

    // 자동확정 조건
    let resolved =
      !!top && top.score >= minScore && (!second || top.score - second.score >= minGap);

    // ✅ 토큰 3개 이상인 경우: 고신뢰도 점수 요구
    const tokenCount = stripQtyAndUnit(it.name).split(" ").filter(Boolean).length;
    if (tokenCount >= 3) {
      const gap = second ? top.score - second.score : 999;
      
      // learned가 있는 경우 (기존 로직 유지)
      if (learned?.kind === "contains_weak") {
        const allowAuto = (top.score >= 0.95 && gap >= 0.20) || (top.score >= 0.88 && gap >= 0.30);
        if (!allowAuto) {
          resolved = false;
        }
      } 
      // learned가 없는 경우 (신규 품목): 더 높은 기준 적용
      else if (!learned) {
        const allowAuto = (top.score >= 0.95 && gap >= 0.20) || (top.score >= 0.90 && gap >= 0.50);
        if (!allowAuto) {
          resolved = false;
        }
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
        method: learned?.kind ? `weighted+${learned.kind}` : "weighted",
        candidates: scored.slice(0, topN).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
          _debug: c._debug,
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
        _debug: c._debug,
      })),
      suggestions: scored.slice(0, Math.max(3, topN)).map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
      })),
    };
  });
}
