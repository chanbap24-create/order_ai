// Vivino 보틀 이미지 검색.
// 검색 결과 페이지의 (병 썸네일, 와인명) 후보를 추출하고,
// **와인명이 실제로 일치하는 후보만** 사용한다 (다른 생산자 병 오인 방지).

import { logger } from "@/app/lib/logger";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// 토큰 비교에서 제외할 범용 단어 (포트/토니 류 와인끼리 과잉 매칭 방지)
const STOPWORDS = new Set(["the", "and", "old", "year", "years", "wine", "vintage"]);

/** 와인명 → 비교용 토큰 (소문자, 특수문자 제거, 1글자·범용어 제외) */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\\u0026/g, "&")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** 토큰 일치 (3글자 이상은 접두 일치 허용: graham ↔ grahams) */
function tokenEq(a: string, b: string): boolean {
  if (a === b) return true;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false; // 숫자는 정확 일치만
  return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
}

/**
 * 검색한 와인명과 후보 와인명이 같은 와인인지 판정.
 * 1) 첫 토큰(생산자)이 후보에 있어야 함
 * 2) 숫자 토큰(숙성 연수 등)은 전부 일치해야 함
 * 3) 전체 토큰의 60% 이상 일치
 */
function nameMatches(queryName: string, candidateName: string): boolean {
  const q = tokenize(queryName.replace(/^[A-Za-z]{2}\s+(?=[A-Z])/, "")); // 전산 코드 접두어 제거
  const c = tokenize(candidateName);
  if (q.length === 0 || c.length === 0) return false;
  if (!c.some((t) => tokenEq(q[0], t))) return false;
  for (const num of q.filter((t) => /^\d+$/.test(t))) {
    if (!c.includes(num)) return false;
  }
  const hit = q.filter((qt) => c.some((ct) => tokenEq(qt, ct))).length;
  return hit / q.length >= 0.6;
}

/** 검색 결과 HTML에서 (썸네일 URL, 와인명) 후보 추출 */
function extractCandidates(html: string, pattern: RegExp): Array<{ url: string; name: string }> {
  const txt = html.replace(/&quot;/g, '"');
  const out: Array<{ url: string; name: string }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(txt))) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    // 썸네일 직전 컨텍스트에서 가장 가까운 "name" 필드를 해당 와인명으로 본다
    const ctx = txt.slice(Math.max(0, m.index - 2500), m.index);
    const names = [...ctx.matchAll(/"name":"([^"]{3,90})"/g)];
    const name = names.length ? names[names.length - 1][1] : "";
    out.push({ url: `https:${m[0]}`, name });
  }
  return out;
}

const PB_PATTERN = /\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_(?:x960|x600|[A-Za-z0-9x]+)\.png/g;
const PL_PATTERN = /\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pl_480x640\.png/g;

/**
 * Vivino에서 와인 보틀 이미지 검색 (누키 PNG 보틀샷).
 * 검색어를 줄여가며 시도하되, 결과 와인명이 검색 와인과 일치할 때만 채택.
 * 일치 후보가 없으면 null (잘못된 병보다 없는 게 낫다 → 호출부에서 폴백).
 */
export async function searchVivinoBottleImage(wineNameEn: string): Promise<string | null> {
  if (!wineNameEn) return null;

  const queries = [wineNameEn];
  const words = wineNameEn.split(/\s+/);
  if (words.length > 3) {
    queries.push(words.slice(0, Math.ceil(words.length * 0.6)).join(" "));
  }
  if (words.length > 2) {
    queries.push(words.slice(0, 3).join(" "));
  }

  for (const q of queries) {
    try {
      const res = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // 보틀샷(_pb_) 우선, 없으면 라벨(_pl_) — 둘 다 이름 일치 필수
      for (const pattern of [PB_PATTERN, PL_PATTERN]) {
        pattern.lastIndex = 0;
        const candidates = extractCandidates(html, pattern);
        const match = candidates.find((cand) => cand.name && nameMatches(wineNameEn, cand.name));
        if (match) {
          logger.info(`[Vivino] Matched "${match.name}" (q="${q}"): ${match.url}`);
          return match.url;
        }
        if (candidates.length > 0) {
          logger.info(`[Vivino] ${candidates.length} candidates but no name match (q="${q}", top="${candidates[0].name}")`);
        }
      }
    } catch {
      // 다음 쿼리 시도
    }
  }

  logger.warn(`[Vivino] No matching bottle image for: ${wineNameEn}`);
  return null;
}
