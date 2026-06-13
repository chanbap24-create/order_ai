// app/lib/producerAliases.ts
// 생산자/브랜드 약어 사전 — "로쉬벨렌 → BL" 처럼 발주 표현을 우리 품명 코드(BL/MD/LM…)로 연결.
//
// 우리 카탈로그는 생산자를 품명 앞 2~4자 라틴 코드로 표기한다(BL=로쉬 드 벨렌 등).
// 발주문엔 한글 생산자명(로쉬벨렌)이 오므로 이 둘을 연결해야 그 생산자의 *모든* 와인이 매칭된다.
//
// 저장 위치: item_alias 테이블 재사용. canonical 이 품번(6~8자)이 아니라
//   짧은 라틴 코드(예: "BL")인 행을 "생산자 약어"로 해석한다.
//   → 학습/편집이 기존 별칭과 같은 경로(/api/learn-item-alias)로 가능.

import { supabase } from "@/app/lib/db";

/** 생산자/브랜드 코드 형식 — 라틴 2~4자 (BL, MD, LM, CDV…) */
export function isProducerCode(canonical: string): boolean {
  return /^[A-Za-z]{2,4}$/.test((canonical || "").trim());
}

/**
 * 한글 자모 정규화 — 음절을 (초/중/종) 자모로 분해하고, 흔히 혼동되는 모음을 통합.
 * ㅐ↔ㅔ, ㅒ↔ㅖ (OCR/오타 최빈 혼동). 공백/구두점 제거, 라틴/숫자는 소문자 유지.
 * 예: "로쉬밸랜" ≈ "로쉬벨렌" (자모 동일), "로쉐벨렌"은 편집거리 1.
 */
export function koreanJamo(s: string): string {
  let out = "";
  for (const ch of (s || "").toLowerCase()) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      const cho = Math.floor(idx / 588);
      let jung = Math.floor((idx % 588) / 28);
      const jong = idx % 28;
      if (jung === 1) jung = 5; // ㅐ→ㅔ
      if (jung === 3) jung = 7; // ㅒ→ㅖ
      out += String.fromCharCode(0x1100 + cho) + String.fromCharCode(0x1161 + jung);
      if (jong) out += String.fromCharCode(0x11a7 + jong);
    } else if (/[\s/,()\-_·•・|\\[\]{}"'%]/.test(ch)) {
      // 구분자 제거
    } else {
      out += ch;
    }
  }
  return out;
}

/** 편집거리 (Levenshtein) */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** needle(자모)가 haystack(자모)에 퍼지 포함되는지 — 편집거리 허용 윈도우 슬라이딩 */
function fuzzyContainsKo(hay: string, needle: string): boolean {
  if (needle.length < 4) return hay.includes(needle); // 너무 짧으면 정확 매칭만
  if (hay.includes(needle)) return true;
  const tol = needle.length <= 8 ? 1 : 2;
  for (let len = needle.length - tol; len <= needle.length + tol; len++) {
    if (len < 4) continue;
    for (let i = 0; i + len <= hay.length; i++) {
      if (editDistance(hay.slice(i, i + len), needle) <= tol) return true;
    }
  }
  return false;
}

type ProducerAliases = {
  /** code(대문자) → 원본 alias 표현 리스트 (프롬프트 표기용) */
  codeToAliases: Map<string, string[]>;
  /** 정규화 alias → code(대문자) (발주문 매칭용) */
  normAliasToCode: Array<{ normAlias: string; code: string }>;
};

let cache: ProducerAliases | null = null;
let cacheTs = 0;
const TTL = 5 * 60 * 1000;

async function load(): Promise<ProducerAliases> {
  if (cache && Date.now() - cacheTs < TTL) return cache;
  const codeToAliases = new Map<string, string[]>();
  const normAliasToCode: Array<{ normAlias: string; code: string }> = [];
  try {
    const { data } = await supabase.from("item_alias").select("alias, canonical");
    for (const r of (data || []) as { alias: string; canonical: string }[]) {
      const alias = (r.alias || "").trim();
      const canonical = (r.canonical || "").trim();
      if (!alias || !isProducerCode(canonical)) continue;
      const code = canonical.toUpperCase();
      if (!codeToAliases.has(code)) codeToAliases.set(code, []);
      codeToAliases.get(code)!.push(alias);
      const n = koreanJamo(alias);
      if (n.length >= 4) normAliasToCode.push({ normAlias: n, code });
    }
  } catch {
    /* 없으면 빈 사전 */
  }
  // 긴 alias 먼저 (부분 약어 오매칭 방지)
  normAliasToCode.sort((a, b) => b.normAlias.length - a.normAlias.length);
  cache = { codeToAliases, normAliasToCode };
  cacheTs = Date.now();
  return cache;
}

/**
 * 코드 → 대표 한글 생산자명 맵 (카탈로그 텍스트 enrich 용).
 * 예: BL → "로쉬벨렌". 대표는 공백 없는 가장 짧은 별칭을 택한다.
 */
export async function getBrandNameMap(): Promise<Map<string, string>> {
  const { codeToAliases } = await load();
  const map = new Map<string, string>();
  for (const [code, aliases] of codeToAliases) {
    const sorted = [...new Set(aliases)].sort((a, b) => {
      const sa = a.includes(" ") ? 1 : 0, sb = b.includes(" ") ? 1 : 0;
      return sa - sb || a.length - b.length;
    });
    if (sorted[0]) map.set(code, sorted[0]);
  }
  return map;
}

/**
 * LLM 프롬프트에 넣을 "생산자/브랜드 약어" 섹션. 없으면 ''.
 */
export async function getProducerAliasBlock(): Promise<string> {
  const { codeToAliases } = await load();
  if (codeToAliases.size === 0) return "";
  const lines: string[] = [];
  for (const [code, aliases] of codeToAliases) {
    const uniq = Array.from(new Set(aliases));
    lines.push(`- ${uniq.join(" · ")} → 품명 "${code} …"로 시작하는 와인`);
  }
  return (
    "생산자/브랜드 약어 (아래 왼쪽 표현이 발주문에 나오면, 품명이 해당 코드로 시작하는 와인 중에서 와인종류/빈티지로 매칭):\n" +
    lines.join("\n")
  );
}

/**
 * 모든 생산자 약어를 토큰 단위로 분해한 집합 (소문자).
 * 예: "메종 로쉬벨렌", "로쉬 드 벨렌" → {메종, 로쉬벨렌, 로쉬, 드, 벨렌}
 * query 에서 생산자 표현을 제거해 와인종류 키워드만 남길 때 사용.
 */
export async function getProducerAliasTokens(): Promise<Set<string>> {
  const { codeToAliases } = await load();
  const tokens = new Set<string>();
  for (const aliases of codeToAliases.values()) {
    for (const alias of aliases) {
      for (const t of alias.toLowerCase().split(/\s+/)) {
        const tok = t.trim();
        if (tok.length >= 2) tokens.add(tok);
      }
    }
  }
  return tokens;
}

/**
 * 발주문에 등장하는 생산자 약어의 코드 집합 반환 (후보풀 확장용).
 * 정규화 후 부분 포함 매칭.
 */
export async function matchedProducerCodes(orderText: string): Promise<Set<string>> {
  const { normAliasToCode } = await load();
  const codes = new Set<string>();
  if (!orderText) return codes;
  const q = koreanJamo(orderText);
  for (const { normAlias, code } of normAliasToCode) {
    if (fuzzyContainsKo(q, normAlias)) codes.add(code);
  }
  return codes;
}
