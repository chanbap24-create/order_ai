import { db } from "@/app/lib/db";
import { calculateWeightedScore } from "@/app/lib/weightedScoring";
import { expandQuery, logQueryExpansion } from "@/app/lib/queryExpander";
import { searchRiedelSheet } from "@/app/lib/riedelMatcher";

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

function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  // ✅ 단위 포함 수량 제거 (Korean \b 호환: \b 대신 경계 없이 매칭)
  s = s.replace(/(\d+)\s*(병|박스|cs|box|bt|btl|개|잔)/gi, "").trim();
  // ✅ 슬래시/대시 뒤 숫자는 코드 일부이므로 보호 (0330/07의 07을 지우면 안됨)
  // 슬래시나 대시가 앞에 없는 경우에만 후행 숫자 제거
  s = s.replace(/(?<![\/\-])\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function norm(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

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

/* ================= Glass 코드 추출 / 비교 ================= */
// RD 0447/07 → 0447/07
function extractRDCode(itemName: string): string | null {
  const m = String(itemName || "").match(/RD\s+(\d{4}\/\d{1,3}[A-Z]?)/i);
  return m ? m[1] : null;
}

// ✅ Glass 코드 정규화: 330/07 → 0330/07 (선행 0 보정)
function normalizeGlassCode(code: string): string {
  if (!code) return code;
  const parts = code.split('/');
  if (parts.length === 2) {
    let prefix = parts[0];
    if (/^\d{3}$/.test(prefix)) {
      prefix = '0' + prefix;
    }
    return `${prefix}/${parts[1]}`;
  }
  return code;
}

// ✅ 코드 비교 (0425/0 == 0425/00, 330/07 == 0330/07)
function codesMatch(input: string, dbCode: string): boolean {
  if (!input || !dbCode) return false;
  // ✅ 선행 0 정규화 후 비교
  const a = normalizeGlassCode(input).toUpperCase();
  const b = normalizeGlassCode(dbCode).toUpperCase();
  if (a === b) return true;
  
  // 슬래시 기준으로 분리해서 숫자 부분 비교 (0425/0 vs 0425/00)
  const [aPrefix, aSuffix] = a.split('/');
  const [bPrefix, bSuffix] = b.split('/');
  if (!aPrefix || !bPrefix || !aSuffix || !bSuffix) return false;
  if (aPrefix !== bPrefix) return false;
  
  // 접미사의 숫자 부분을 정수로 비교 (0 == 00, 7 == 07)
  const aNum = parseInt(aSuffix.replace(/[A-Z]/gi, ''), 10);
  const bNum = parseInt(bSuffix.replace(/[A-Z]/gi, ''), 10);
  const aLetter = aSuffix.replace(/\d/g, '');
  const bLetter = bSuffix.replace(/\d/g, '');
  
  return aNum === bNum && aLetter === bLetter;
}

/* ================= 신규 품목 검색 (Riedel 시트) ================= */

function searchNewGlassFromRiedel(query: string): Array<{ code: string; item_name: string; score: number; is_new_item?: boolean; price?: number }> {
  try {
    const candidates = searchRiedelSheet(query, 3);
    return candidates.map((c) => ({
      code: c.code,
      item_name: `${c.koreanName} / ${c.englishName}`,
      score: Number(c.score.toFixed(3)),
      is_new_item: true,
      price: c.price,
    }));
  } catch (err) {
    console.error('신규 Glass 품목 검색 실패:', err);
    return [];
  }
}

/* ================= 멀티 토큰 검색 (Wine과 동일) ================= */

function getAllTokens(rawName: string): string[] {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));
  
  return clean;
}

function fetchFromGlassMasterByTokens(rawName: string, limit = 80): Array<{ item_no: string; item_name: string }> {
  const tokens = getAllTokens(rawName);
  if (tokens.length === 0) return [];

  try {
    const results = new Map<string, { item_no: string; item_name: string; priority: number }>();
    
    // 전략 1: AND 검색 (모든 토큰 포함) - 최고 우선순위
    if (tokens.length >= 2) {
      try {
        const andWhere = tokens.map(() => `item_name LIKE ?`).join(" AND ");
        const andParams = tokens.map((t) => `%${t}%`);
        const andSql = `
          SELECT item_no, item_name
          FROM glass_items
          WHERE ${andWhere}
          LIMIT 30
        `;
        const andResults = db.prepare(andSql).all(...andParams) as Array<{ item_no: string; item_name: string }>;
        
        for (const r of andResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 3 });
          }
        }
        
        console.log(`[Glass MultiToken] AND 검색: "${tokens.join('" AND "')}" → ${andResults.length}개`);
      } catch (e) {
        console.error('[Glass MultiToken] AND 검색 실패:', e);
      }
    }
    
    // 전략 2: Half 검색 (절반 이상 토큰 포함) - 중간 우선순위
    if (tokens.length >= 3) {
      try {
        const halfCount = Math.ceil(tokens.length / 2);
        const halfTokens = tokens.slice(0, halfCount);
        const halfWhere = halfTokens.map(() => `item_name LIKE ?`).join(" AND ");
        const halfParams = halfTokens.map((t) => `%${t}%`);
        const halfSql = `
          SELECT item_no, item_name
          FROM glass_items
          WHERE ${halfWhere}
          LIMIT 40
        `;
        const halfResults = db.prepare(halfSql).all(...halfParams) as Array<{ item_no: string; item_name: string }>;
        
        for (const r of halfResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 2 });
          }
        }
        
        console.log(`[Glass MultiToken] Half 검색: "${halfTokens.join('" AND "')}" → ${halfResults.length}개`);
      } catch (e) {
        console.error('[Glass MultiToken] Half 검색 실패:', e);
      }
    }
    
    // 전략 3: OR 검색 (하나라도 포함) - 낮은 우선순위
    try {
      const orWhere = tokens.map(() => `item_name LIKE ?`).join(" OR ");
      const orParams = tokens.map((t) => `%${t}%`);
      const orSql = `
        SELECT item_no, item_name
        FROM glass_items
        WHERE ${orWhere}
        LIMIT 30
      `;
      const orResults = db.prepare(orSql).all(...orParams) as Array<{ item_no: string; item_name: string }>;
      
      for (const r of orResults) {
        if (!results.has(r.item_no)) {
          results.set(r.item_no, { ...r, priority: 1 });
        }
      }
      
      console.log(`[Glass MultiToken] OR 검색: "${tokens.join('" OR "')}" → ${orResults.length}개`);
    } catch (e) {
      console.error('[Glass MultiToken] OR 검색 실패:', e);
    }
    
    // 우선순위 순으로 정렬하고 limit 적용
    const sorted = Array.from(results.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map(({ item_no, item_name }) => ({ item_no, item_name }));
    
    console.log(`[Glass MultiToken] 총 후보: ${sorted.length}개 (중복 제거 후)`);
    
    return sorted;
  } catch (e) {
    console.error('[Glass MultiToken] 전체 검색 실패:', e);
    return [];
  }
}

/* ================= 약어 학습 시스템 (Wine과 동일) ================= */

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

/* ================= 메인: Glass 전용 ================= */
export function resolveGlassItemsByClient(
  clientCode: string,
  items: Array<{ name: string; qty: number; code?: string }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
) {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 5;

  // ✅ Glass 거래처 이력 후보
  const clientRows = db
    .prepare(
      `SELECT item_no, item_name
       FROM glass_client_item_stats
       WHERE client_code = ?`
    )
    .all(clientCode) as Array<{ item_no: string; item_name: string }>;

  // ✅ Glass 전체 품목 마스터 (코드 매칭용)
  const allItems = db
    .prepare(`SELECT item_no, item_name FROM glass_items`)
    .all() as Array<{ item_no: string; item_name: string }>;

  return items.map((it) => {
    // 🔍 0단계: 품목번호 직접 입력 감지 (최우선)
    // 예: "0884/33", "0447/07", "0884/0", "4100/00R" 같은 와인잔 품목번호
    const itemNoPattern = /^([A-Z]?\d{3,4}[\/-]?\d{1,3}[A-Z]?)$/i;
    const itemNoMatch = stripQtyAndUnit(it.name).trim().match(itemNoPattern);
    
    if (itemNoMatch) {
      const inputItemNo = normalizeGlassCode(itemNoMatch[1]).toUpperCase();
      console.log(`[Glass ItemNo Exact] 와인잔 품목번호 입력 감지: "${inputItemNo}"`);
      
      // 🍷 와인잔 패턴: "RD {번호}" 형식으로 품목명 내부 검색
      try {
        // ✅ 정확 매칭 우선: codesMatch로 0425/0 == 0425/00 처리
        console.log(`[Glass Pattern] 와인잔 패턴 검색: "RD ${inputItemNo}"`);
        
        // 정확 매칭: codesMatch 사용 (0 == 00 포함)
        const exactCodeMatches = allItems.filter((r) => {
          const rdCode = extractRDCode(r.item_name);
          return rdCode && codesMatch(inputItemNo, rdCode);
        });
        
        if (exactCodeMatches.length > 0) {
          // 거래처 이력에 있는 것 우선
          const clientHit = exactCodeMatches.find(m => clientRows.some(r => r.item_no === m.item_no));
          const best = clientHit || exactCodeMatches[0];
          const inClientHistory = !!clientHit;
          
          console.log(`[Glass Pattern] ✅ 코드 정확 매칭: ${best.item_no} - ${best.item_name} (거래처이력: ${inClientHistory})`);
          
          // ✅ 거래처 이력에 있으면 자동확정, 없으면 확인필요
          return {
            ...it,
            normalized_query: it.name,
            resolved: inClientHistory,
            item_no: best.item_no,
            item_name: best.item_name,
            score: inClientHistory ? 1.0 : 0.95,
            method: "exact_rd_code",
            not_in_client_history: !inClientHistory,
            candidates: exactCodeMatches.map(m => ({
              item_no: m.item_no, item_name: m.item_name, score: 1.0,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
            suggestions: exactCodeMatches.map(m => ({
              item_no: m.item_no, item_name: m.item_name, score: 1.0,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
          };
        }
        
        // ✅ 접두사 매칭: "0884/0" → "0884/0", "0884/07" 등
        const prefixCodeMatches = allItems.filter((r) => {
          const rdCode = extractRDCode(r.item_name);
          return rdCode && rdCode.toUpperCase().startsWith(inputItemNo.toUpperCase());
        });
        
        if (prefixCodeMatches.length > 0) {
          // 거래처 이력에 있는 것 우선 정렬
          const sorted = prefixCodeMatches.sort((a, b) => {
            const aClient = clientRows.some(r => r.item_no === a.item_no) ? 1 : 0;
            const bClient = clientRows.some(r => r.item_no === b.item_no) ? 1 : 0;
            if (aClient !== bClient) return bClient - aClient;
            // 코드 길이가 짧은 것(정확 매칭에 가까운 것) 우선
            const aCode = extractRDCode(a.item_name) || '';
            const bCode = extractRDCode(b.item_name) || '';
            return aCode.length - bCode.length;
          });
          
          const best = sorted[0];
          const bestInClientHistory = clientRows.some(r => r.item_no === best.item_no);
          // 1개이면서 거래처 이력에 있을 때만 자동확정
          const autoResolve = prefixCodeMatches.length === 1 && bestInClientHistory;
          
          console.log(`[Glass Pattern] ✅ 코드 접두사 매칭 ${prefixCodeMatches.length}개: ${sorted.map(m => extractRDCode(m.item_name)).join(', ')} (거래처이력: ${bestInClientHistory})`);
          
          if (autoResolve) {
            return {
              ...it,
              normalized_query: it.name,
              resolved: true,
              item_no: best.item_no,
              item_name: best.item_name,
              score: 1.0,
              method: "prefix_rd_code",
              candidates: sorted.map(m => ({
                item_no: m.item_no, item_name: m.item_name, score: 1.0,
                in_client_history: clientRows.some(r => r.item_no === m.item_no),
              })),
              suggestions: sorted.map(m => ({
                item_no: m.item_no, item_name: m.item_name, score: 1.0,
                in_client_history: clientRows.some(r => r.item_no === m.item_no),
              })),
            };
          }
          
          // 여러 개이거나 거래처 이력에 없으면 확인필요
          return {
            ...it,
            normalized_query: it.name,
            resolved: false,
            item_no: best.item_no,
            item_name: best.item_name,
            score: 0.95,
            method: prefixCodeMatches.length === 1 ? "prefix_rd_code" : "prefix_rd_code_multi",
            not_in_client_history: !bestInClientHistory,
            candidates: sorted.map(m => ({
              item_no: m.item_no, item_name: m.item_name, score: 0.95,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
            suggestions: sorted.map(m => ({
              item_no: m.item_no, item_name: m.item_name, score: 0.95,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
          };
        }
        
        // ✅ 폴백: 기존 LIKE 검색 (RD 없이 숫자만 입력한 경우)
        const glassPattern = `%RD ${inputItemNo}%`;
        const glassPattern2 = `%RD ${inputItemNo.replace(/\//g, '-')}%`;
        const glassPattern3 = `%RD ${inputItemNo.replace(/[\/-]/g, '')}%`;
        
        // 1) 거래처 이력에서 품목명 내부 번호로 검색
        const clientGlass = db.prepare(`
          SELECT item_no, item_name
          FROM glass_client_item_stats
          WHERE client_code = ? AND (
            UPPER(item_name) LIKE UPPER(?) OR
            UPPER(item_name) LIKE UPPER(?) OR
            UPPER(item_name) LIKE UPPER(?)
          )
          LIMIT 1
        `).get(clientCode, glassPattern, glassPattern2, glassPattern3) as any;
        
        if (clientGlass) {
          console.log(`[Glass Pattern] ✅ 거래처 이력에서 와인잔 발견: ${clientGlass.item_no} - ${clientGlass.item_name}`);
          return {
            ...it,
            normalized_query: it.name,
            resolved: true,
            item_no: clientGlass.item_no,
            item_name: clientGlass.item_name,
            score: 1.0,
            method: "glass_pattern_client",
            candidates: [{ item_no: clientGlass.item_no, item_name: clientGlass.item_name, score: 1.0, in_client_history: true }],
            suggestions: [{ item_no: clientGlass.item_no, item_name: clientGlass.item_name, score: 1.0, in_client_history: true }],
          };
        }
        
        // 2) 전체 품목에서 품목명 내부 번호로 검색 → 거래처 이력에 없으므로 확인필요
        const masterGlass = allItems.find((r) => {
          const itemNameUpper = r.item_name.toUpperCase();
          return itemNameUpper.includes(`RD ${inputItemNo}`) ||
                 itemNameUpper.includes(`RD ${inputItemNo.replace(/\//g, '-')}`) ||
                 itemNameUpper.includes(`RD ${inputItemNo.replace(/[\/-]/g, '')}`);
        });
        
        if (masterGlass) {
          console.log(`[Glass Pattern] ⚠️ 전체 품목에서 와인잔 발견 (거래처 미입고): ${masterGlass.item_no} - ${masterGlass.item_name}`);
          return {
            ...it,
            normalized_query: it.name,
            resolved: false,
            item_no: masterGlass.item_no,
            item_name: masterGlass.item_name,
            score: 0.95,
            method: "glass_pattern_master",
            not_in_client_history: true,
            candidates: [{ item_no: masterGlass.item_no, item_name: masterGlass.item_name, score: 0.95, in_client_history: false }],
            suggestions: [{ item_no: masterGlass.item_no, item_name: masterGlass.item_name, score: 0.95, in_client_history: false }],
          };
        }
      } catch (e) {
        console.error('[Glass Pattern] 와인잔 패턴 검색 실패:', e);
      }
      
      console.log(`[Glass ItemNo Exact] ❌ 와인잔 품목번호를 찾을 수 없음: ${inputItemNo}`);
    }
    
    // ✅ 1순위: 코드가 있으면 코드로 정확히 매칭 (전체 품목에서 검색)
    if (it.code) {
      // ✅ 정확 매칭 우선 (0425/0 == 0425/00 포함)
      const codeMatch = allItems.find((r) => {
        const rdCode = extractRDCode(r.item_name);
        return rdCode && codesMatch(it.code!, rdCode);
      });

      if (codeMatch) {
        const codeInClientHistory = clientRows.some(r => r.item_no === codeMatch.item_no);
        console.log(`[Glass] 1순위 exact_code: ${codeMatch.item_no} (거래처이력: ${codeInClientHistory})`);
        
        return {
          ...it,
          normalized_query: it.code,
          resolved: codeInClientHistory,
          item_no: codeMatch.item_no,
          item_name: codeMatch.item_name,
          score: codeInClientHistory ? 1.0 : 0.95,
          method: "exact_code",
          not_in_client_history: !codeInClientHistory,
          candidates: [
            {
              item_no: codeMatch.item_no,
              item_name: codeMatch.item_name,
              score: 1.0,
              in_client_history: codeInClientHistory,
            },
          ],
          suggestions: [
            {
              item_no: codeMatch.item_no,
              item_name: codeMatch.item_name,
              score: 1.0,
              in_client_history: codeInClientHistory,
            },
          ],
        };
      }
    }

    // ✅ 1.5순위: 품목명 안에 코드 패턴이 숨어있는 경우 추출하여 매칭
    // 예: "크로스비 0425/0" → 코드 0425/0 추출, "330/07" → 0330/07
    if (!it.code) {
      const embeddedCodeMatch = it.name.match(/(\d{3,4}\/\d{1,3}[A-Z]?)/i);
      if (embeddedCodeMatch) {
        const embeddedCode = normalizeGlassCode(embeddedCodeMatch[1]);
        console.log(`[Glass] 1.5순위: 품목명에서 코드 추출: "${embeddedCode}" (from "${it.name}")`);
        
        // codesMatch로 정확 매칭
        const codeMatch = allItems.find((r) => {
          const rdCode = extractRDCode(r.item_name);
          return rdCode && codesMatch(embeddedCode, rdCode);
        });
        
        if (codeMatch) {
          const inHistory = clientRows.some(r => r.item_no === codeMatch.item_no);
          console.log(`[Glass] 1.5순위 ✅ 코드 매칭: ${codeMatch.item_no} - ${codeMatch.item_name} (거래처이력: ${inHistory})`);
          return {
            ...it,
            normalized_query: embeddedCode,
            resolved: inHistory,
            item_no: codeMatch.item_no,
            item_name: codeMatch.item_name,
            score: inHistory ? 1.0 : 0.95,
            method: "embedded_code",
            not_in_client_history: !inHistory,
            candidates: [{ item_no: codeMatch.item_no, item_name: codeMatch.item_name, score: 1.0, in_client_history: inHistory }],
            suggestions: [{ item_no: codeMatch.item_no, item_name: codeMatch.item_name, score: 1.0, in_client_history: inHistory }],
          };
        }
        
        // 접두사 매칭
        const prefixMatches = allItems.filter((r) => {
          const rdCode = extractRDCode(r.item_name);
          return rdCode && rdCode.toUpperCase().startsWith(embeddedCode.toUpperCase());
        });
        
        if (prefixMatches.length === 1) {
          const best = prefixMatches[0];
          const inHistory = clientRows.some(r => r.item_no === best.item_no);
          console.log(`[Glass] 1.5순위 ✅ 접두사 매칭 (1개): ${best.item_no} - ${best.item_name}`);
          return {
            ...it,
            normalized_query: embeddedCode,
            resolved: inHistory,
            item_no: best.item_no,
            item_name: best.item_name,
            score: inHistory ? 1.0 : 0.95,
            method: "embedded_prefix_code",
            not_in_client_history: !inHistory,
            candidates: prefixMatches.map(m => ({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
            suggestions: prefixMatches.map(m => ({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
          };
        }
        
        if (prefixMatches.length > 1) {
          const sorted = prefixMatches.sort((a, b) => {
            const aClient = clientRows.some(r => r.item_no === a.item_no) ? 1 : 0;
            const bClient = clientRows.some(r => r.item_no === b.item_no) ? 1 : 0;
            return bClient - aClient;
          });
          console.log(`[Glass] 1.5순위 ⚠️ 접두사 매칭 ${prefixMatches.length}개 → 후보 제시`);
          return {
            ...it,
            normalized_query: embeddedCode,
            resolved: false,
            candidates: sorted.map(m => ({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
            suggestions: sorted.map(m => ({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
          };
        }
      }
    }

    // ✅ 2순위: 검색어 확장 (토큰 매핑 학습 활용)
    const expansion = expandQuery(it.name, 0.5);
    logQueryExpansion(expansion);
    
    const learned = getLearnedMatch(it.name);
    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // 마스터 후보 (원본 + 확장된 검색어) - 멀티 토큰 검색
    const masterRows1 = fetchFromGlassMasterByTokens(it.name, 40);
    const masterRows2 = expansion.hasExpansion 
      ? fetchFromGlassMasterByTokens(expansion.expanded, 40)
      : [];

    // 후보 풀 = 거래처이력 + 마스터(원본) + 마스터(확장) (중복 제거)
    const poolMap = new Map<string, { item_no: string; item_name: string }>();
    for (const r of clientRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of masterRows1) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of masterRows2) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    const pool = Array.from(poolMap.values());

    // 1) Exact 학습이면 하드 확정
    if (learned && learned.kind === "exact" && learnedItemNo) {
      const hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        return {
          ...it,
          normalized_query: norm(it.name),
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
          normalized_query: norm(it.name),
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
    const q = norm(stripQtyAndUnit(it.name));
    const qExpanded = expansion.hasExpansion ? norm(expansion.expanded) : q;

    let scored = pool
      .map((r) => {
        // 원본 쿼리 점수
        const score1 = scoreItem(q, r.item_name);
        
        // 확장된 쿼리 점수 (학습 효과)
        const score2 = expansion.hasExpansion ? scoreItem(qExpanded, r.item_name) : 0;
        
        // 최고 점수 선택 (확장 검색은 20% 부스트)
        const baseScore = Math.max(score1, score2 * 1.2);

        // 🎯 가중치 시스템으로 최종 점수 계산
        const weighted = calculateWeightedScore(
          it.name,
          clientCode,
          String(r.item_no),
          baseScore,
          'glass' // Glass 전용 테이블 지정
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
            weights: weighted.weights,
            rawTotal: weighted.rawTotal,
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    let top = scored[0];
    let second = scored[1];

    // ✅ 신규 품목 여부 확인
    // 1. 거래처 구매 이력에 없으면 신규 품목 (가장 중요!)
    const hasClientHistory = top && clientRows.some(r => r.item_no === top.item_no);
    // 2. DB에 아예 없으면 신규 품목
    const isInDb = top && allItems.some(r => r.item_no === top.item_no);
    
    const isNewItem = top && (!hasClientHistory || !isInDb);
    
    console.log(`[DEBUG Glass] Auto-resolve check: item=${top?.item_no}, hasClientHistory=${hasClientHistory}, isInDb=${isInDb}, isNewItem=${isNewItem}`);

    // 자동확정 조건
    let resolved =
      !!top && 
      !isNewItem && // ✅ 신규 품목은 절대 자동확정 안 함
      top.score >= minScore && 
      (!second || top.score - second.score >= minGap);

    // ✅ 토큰 3개 이상인 경우: 고신뢰도 점수 요구
    const tokenCount = stripQtyAndUnit(it.name).split(" ").filter(Boolean).length;
    if (tokenCount >= 3) {
      const gap = second ? top.score - second.score : 999;
      
      // learned가 있는 경우
      if (learned?.kind === "contains_weak") {
        const allowAuto = (top.score >= 0.92 && gap >= 0.20) || 
                          (top.score >= 0.88 && gap >= 0.30);
        if (!allowAuto) {
          resolved = false;
        }
      } 
      // learned가 없는 경우
      else if (!learned) {
        const allowAuto = (top.score >= 0.90 && gap >= 0.20) || 
                          (top.score >= 0.85 && gap >= 0.25);
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
          _debug: (c as any)._debug,
        })),
        suggestions: (() => {
          // 자동확정이어도 신규품목 함께 표시
          const existingTop = scored.slice(0, 2).map((c) => ({
            item_no: c.item_no,
            item_name: c.item_name,
            score: Number(c.score.toFixed(3)),
          }));
          
          const newItems = searchNewGlassFromRiedel(q).map(item => ({
            item_no: item.code,
            item_name: item.item_name,
            score: Number(item.score.toFixed(3)),
            is_new_item: true,
            price: item.price,
          }));
          
          const combined = [...existingTop, ...newItems.slice(0, 3)];
          console.log('[DEBUG Glass] Auto-resolved suggestions:', { existing: existingTop.length, new: newItems.length });
          return combined;
        })(),
      };
    }

    // ✅ 항상 기존품목 + 신규품목 함께 표시 (Glass는 신규품목 확인이 중요)
    console.log('[DEBUG Glass] Building suggestions for:', q);
    const suggestions = (() => {
      // 기존품목 상위 2개
      const existingTop = scored.slice(0, 2).map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
      }));

      console.log('[DEBUG Glass] Searching Riedel for:', q);
      // 신규품목 검색 (Riedel 시트)
      const newItems = searchNewGlassFromRiedel(q).map(item => ({
        item_no: item.code,
        item_name: item.item_name,
        score: Number(item.score.toFixed(3)),
        is_new_item: true,
        price: item.price,
      }));
      
      // 기존 2개 + 신규 상위 3개
      const combined = [...existingTop, ...newItems.slice(0, 3)];
      
      console.log('[DEBUG Glass] 후보 조합:', {
        existing: existingTop.length,
        newItems: newItems.length,
        combined: combined.length,
        topScore: top?.score,
        items: combined.map(c => ({ code: c.item_no, score: c.score, isNew: (c as any).is_new_item, price: (c as any).price }))
      });
      
      return combined;
    })();

    return {
      ...it,
      normalized_query: q,
      resolved: false,
      candidates: scored.slice(0, topN).map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
        _debug: (c as any)._debug,
      })),
      suggestions,
    };
  });
}
