// app/lib/aliasInject.ts
// 미인식(후보 0개) 라인에 학습된 별칭(item_alias)의 품번을 후보로 "주입".
// 추가 LLM 호출 없음(비용 0). orderReviewer는 후보 0개 라인을 건너뛰므로,
// 정작 학습이 가장 필요한 "파서가 못 알아본 품목"을 살리는 단계.
//
// OCR 글자 흔들림(로쉬↔로쉔)·수량 차이(3병↔2병)를 흡수하기 위해
// 정규화(수량/공백/구두점 제거) 후 (1) 포함 매칭 → (2) 편집거리 허용 매칭.

import { supabase } from "@/app/lib/db";

interface InjCandidate {
  item_no: string;
  item_name: string;
  confidence: number;
  supply_price: number;
  available_stock: number;
  reasoning: string;
}
interface InjLine {
  query: string;
  quantity: number;
  candidates: InjCandidate[];
  review_note?: string;
  [k: string]: unknown;
}
interface CatalogItem {
  item_no: string;
  item_name: string;
  supply_price?: number | null;
  available_stock?: number | null;
}

/** 품번 형식(영숫자 6~8자)인지 — 주입은 품번 canonical 만 대상 */
function isItemNo(s: string): boolean {
  return /^[A-Za-z0-9]{6,8}$/.test(s.trim());
}

/** 정규화: 소문자 + 수량(N병/개/잔/박스/케이스) 제거 + 공백·구두점 제거 */
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\d+\s*(병|개|잔|박스|케이스|btl|btls|cs)\b/g, " ")
    .replace(/[\s/,()\-_·•・|\\[\]{}"'%]+/g, "")
    .trim();
}

/** Levenshtein 편집거리 (한글 음절=BMP 단일 코드유닛이라 음절 단위로 동작) */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

type AliasRow = { norm: string; canonical: string };
let cache: AliasRow[] | null = null;
let cacheTs = 0;
const TTL = 5 * 60 * 1000;
const MIN_LEN = 4; // 정규화 후 최소 길이 (짧은 별칭 오매칭 방지)

async function getItemNoAliases(): Promise<AliasRow[]> {
  if (cache && Date.now() - cacheTs < TTL) return cache;
  try {
    const { data } = await supabase.from("item_alias").select("alias, canonical");
    const rows: AliasRow[] = [];
    for (const r of (data || []) as { alias: string; canonical: string }[]) {
      if (r.alias && r.canonical && isItemNo(r.canonical)) {
        const norm = normalize(r.alias);
        if (norm.length >= MIN_LEN) rows.push({ norm, canonical: r.canonical.trim().toUpperCase() });
      }
    }
    cache = rows;
    cacheTs = Date.now();
    return rows;
  } catch {
    return cache || [];
  }
}

/** query 가 학습 별칭과 매칭되면 canonical(품번) 반환 */
function matchAlias(query: string, aliases: AliasRow[]): string | null {
  const q = normalize(query);
  if (q.length < MIN_LEN) return null;

  // 1) 포함 매칭(양방향). 겹치는 길이가 길수록 우선
  let best: { canonical: string; score: number } | null = null;
  for (const a of aliases) {
    if ((q.includes(a.norm) || a.norm.includes(q)) && Math.min(a.norm.length, q.length) >= MIN_LEN) {
      const score = Math.min(a.norm.length, q.length);
      if (!best || score > best.score) best = { canonical: a.canonical, score };
    }
  }
  if (best) return best.canonical;

  // 2) 편집거리 허용(OCR 흔들림). 길이 대비 ~15% 이내
  let bestEd: { canonical: string; dist: number } | null = null;
  for (const a of aliases) {
    const maxLen = Math.max(a.norm.length, q.length);
    const tol = Math.max(1, Math.floor(maxLen * 0.15));
    if (Math.abs(a.norm.length - q.length) > tol) continue;
    const d = editDistance(q, a.norm);
    if (d <= tol && (!bestEd || d < bestEd.dist)) bestEd = { canonical: a.canonical, dist: d };
  }
  return bestEd ? bestEd.canonical : null;
}

/**
 * 학습된 별칭(item_alias)을 LLM 결과보다 우선 적용.
 * - 미인식(후보 0개) 라인 → 학습 품번을 후보로 생성
 * - 이미 후보가 있어도 1순위가 학습 품번과 다르면 → 학습 품번을 1순위로 승격(덮어쓰기)
 *   "한 번 가르친 품목은 항상 그 품목" — 학습이 LLM 추측보다 권위 있음.
 * @returns 적용된 라인 수
 */
export async function injectAliasCandidates<T extends InjLine>(
  orderLines: T[],
  catalog: Map<string, CatalogItem>,
): Promise<number> {
  if (orderLines.length === 0) return 0;
  const aliases = await getItemNoAliases();
  if (aliases.length === 0) return 0;

  let applied = 0;
  for (const line of orderLines) {
    const canonical = matchAlias(line.query || "", aliases);
    if (!canonical) continue;
    const wine = catalog.get(canonical);
    if (!wine) continue; // 카탈로그에 없으면 적용 안 함

    const top = line.candidates?.[0];
    if (top && (top.item_no || "").trim().toUpperCase() === canonical) continue; // 이미 1순위

    const learned: InjCandidate = {
      item_no: wine.item_no,
      item_name: wine.item_name,
      confidence: 0.92,
      supply_price: Number(wine.supply_price) || 0,
      available_stock: Number(wine.available_stock) || 0,
      reasoning: "학습된 별칭 우선 매칭",
    };
    // 학습 품번을 1순위로, 기존 후보는 중복 제거 후 뒤에 보존
    line.candidates = [learned, ...(line.candidates || []).filter((c) => (c.item_no || "").trim().toUpperCase() !== canonical)];
    line.review_note = "학습 별칭으로 자동 선택";
    applied++;
  }
  return applied;
}
