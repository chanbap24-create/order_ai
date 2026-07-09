import { supabase } from "@/app/lib/db";
import { calculateWeightedScore } from "@/app/lib/weightedScoring";
import { expandQuery, logQueryExpansion } from "@/app/lib/queryExpander";
import { searchRiedelSheet } from "@/app/lib/riedelMatcher";
import { loadRiedelSheet } from "@/app/lib/riedelSheet";

// 추출 모듈
import { normLocal, normTight, stripQtyAndUnit, norm, scoreItem } from "./resolve-glass-items/normalize";
import { extractRDCode, normalizeGlassCode, codesMatch } from "./resolve-glass-items/rdCode";
import { matchNonRDItem } from "./resolve-glass-items/nonRdMatch";
import { searchNewGlassFromRiedel } from "./resolve-glass-items/newGlass";
import { getAllTokens, fetchFromGlassMasterByTokens } from "./resolve-glass-items/masterFetch";
import { isSpecificAlias, getLearnedMatch, type LearnedMatch } from "./resolve-glass-items/alias";

/* ================= 메인: Glass 전용 ================= */
export async function resolveGlassItemsByClient(
  clientCode: string,
  items: Array<{ name: string; qty: number; code?: string }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
) {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 20;

  // ✅ Glass 거래처 이력 후보 (supply_price 포함)
  const { data: clientRowsData } = await supabase
    .from('glass_client_item_stats')
    .select('item_no, item_name, supply_price')
    .eq('client_code', clientCode);
  const clientRows = (clientRowsData || []) as Array<{ item_no: string; item_name: string; supply_price?: number }>;

  // ✅ Glass 전체 품목 마스터 (코드 매칭용). 페이지네이션 — glass_items 1000+ 품목이라
  //   단발 조회는 1000행 캡에 걸려 초과 품목이 RD코드 매칭에서 통째로 누락된다.
  const allItems: Array<{ item_no: string; item_name: string; supply_price?: number }> = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase
      .from('glass_items')
      .select('item_no, item_name, supply_price')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    allItems.push(...(data as Array<{ item_no: string; item_name: string; supply_price?: number }>));
    if (data.length < 1000) break;
  }

  // ✅ RD코드 인덱스 맵 (O(N) 스캔 → O(1) 룩업으로 성능 최적화)
  // key = 정규화된 RD코드 (대문자), value = 매칭되는 품목들
  const rdCodeIndex = new Map<string, Array<{ item_no: string; item_name: string; rdCode: string }>>();
  for (const item of allItems) {
    const rdCode = extractRDCode(item.item_name);
    if (rdCode) {
      const normalized = normalizeGlassCode(rdCode).toUpperCase();
      if (!rdCodeIndex.has(normalized)) rdCodeIndex.set(normalized, []);
      rdCodeIndex.get(normalized)!.push({ ...item, rdCode });
    }
  }

  // ✅ 인덱스 기반 코드 매칭 헬퍼: codesMatch 로직을 인덱스에서 수행
  function findByCode(inputCode: string): Array<{ item_no: string; item_name: string }> {
    const normInput = normalizeGlassCode(inputCode).toUpperCase();
    // 1) 정확 매칭 (정규화 후 동일)
    const exact = rdCodeIndex.get(normInput);
    if (exact && exact.length > 0) return exact;

    // 2) 숫자 정규화 매칭 (0425/0 == 0425/00)
    const results: Array<{ item_no: string; item_name: string }> = [];
    for (const [key, items] of rdCodeIndex) {
      if (codesMatch(inputCode, items[0].rdCode)) {
        results.push(...items);
      }
    }
    return results;
  }

  // ✅ 인덱스 기반 접두사 매칭 헬퍼
  function findByPrefix(inputCode: string): Array<{ item_no: string; item_name: string }> {
    const normInput = normalizeGlassCode(inputCode).toUpperCase();
    const results: Array<{ item_no: string; item_name: string }> = [];
    for (const [key, items] of rdCodeIndex) {
      if (key.startsWith(normInput)) {
        results.push(...items);
      }
    }
    return results;
  }

  // ✅ Riedel 시트 정상 공급가 맵 (코드 → 공급가)
  const riedelPriceMap = new Map<string, number>();
  try {
    const riedelItems = loadRiedelSheet();
    for (const item of riedelItems) {
      if (item.price > 0) {
        riedelPriceMap.set(normalizeGlassCode(item.code).toUpperCase(), item.price);
      }
    }
  } catch (e) {
    console.error('[Glass] Riedel 가격맵 로딩 실패:', e);
  }

  // ✅ 정상 공급가 조회 헬퍼 (Riedel 시트 F열 기준)
  function getSupplyPrice(item_no: string): number | undefined {
    // DB 품목명에서 RD코드 추출 → Riedel 시트 공급가 조회
    const dbItem = allItems.find(r => r.item_no === item_no) || clientRows.find(r => r.item_no === item_no);
    if (dbItem) {
      const rdCode = extractRDCode(dbItem.item_name);
      if (rdCode) {
        const normalized = normalizeGlassCode(rdCode).toUpperCase();
        const riedelPrice = riedelPriceMap.get(normalized);
        if (riedelPrice) return riedelPrice;
      }
    }
    return undefined;
  }

  // ✅ candidates/suggestions에 supply_price 포함하는 헬퍼
  function withPrice(m: { item_no: string; item_name: string; score: number; in_client_history?: boolean; [key: string]: any }) {
    const sp = getSupplyPrice(m.item_no);
    return sp ? { ...m, supply_price: sp } : m;
  }

  // items.map() → sequential for loop (async operations inside)
  const results: any[] = [];
  for (const it of items) {
    // 🔍 0단계: 품목번호 직접 입력 감지 (최우선)
    // 예: "0884/33", "0447/07", "0884/0", "4100/00R" 같은 와인잔 품목번호
    const itemNoPattern = /^([A-Z]?\d{3,4}[\/-]?\d{1,3}(?:[A-Z][A-Z0-9]*)?)$/i;
    const itemNoMatch = stripQtyAndUnit(it.name).trim().match(itemNoPattern);

    if (itemNoMatch) {
      const inputItemNo = normalizeGlassCode(itemNoMatch[1]).toUpperCase();
      console.log(`[Glass ItemNo Exact] 와인잔 품목번호 입력 감지: "${inputItemNo}"`);

      // 🍷 와인잔 패턴: "RD {번호}" 형식으로 품목명 내부 검색
      try {
        // ✅ 정확 매칭 우선: codesMatch로 0425/0 == 0425/00 처리
        console.log(`[Glass Pattern] 와인잔 패턴 검색: "RD ${inputItemNo}"`);

        // 정확 매칭: 인덱스 기반 (0 == 00 포함)
        const exactCodeMatches = findByCode(inputItemNo);

        if (exactCodeMatches.length > 0) {
          // 거래처 이력에 있는 것 우선
          const clientHits = exactCodeMatches.filter(m => clientRows.some(r => r.item_no === m.item_no));
          const best = clientHits[0] || exactCodeMatches[0];
          const inClientHistory = clientHits.length > 0;

          // ✅ 중복 코드 처리: 동일 RD코드에 여러 품목이 있으면 신중하게 처리
          // 예: 0412/0 → D701204 (일반) vs D701A04 (2nd), 4100/00 → D700122 (올블랙) vs D700424 (블랙타이)
          const isDuplicateCode = exactCodeMatches.length > 1;

          // 중복 코드 + 거래처 이력에 1개만 있으면 자동확정, 여러 개 있거나 없으면 확인필요
          const canAutoResolve = inClientHistory && (!isDuplicateCode || clientHits.length === 1);

          console.log(`[Glass Pattern] ✅ 코드 정확 매칭: ${best.item_no} - ${best.item_name} (거래처이력: ${inClientHistory}, 중복코드: ${isDuplicateCode}, 자동확정: ${canAutoResolve})`);

          results.push({
            ...it,
            normalized_query: it.name,
            resolved: canAutoResolve,
            item_no: best.item_no,
            item_name: best.item_name,
            score: canAutoResolve ? 1.0 : 0.95,
            method: "exact_rd_code",
            not_in_client_history: !inClientHistory,
            candidates: exactCodeMatches.map(m => withPrice({
              item_no: m.item_no, item_name: m.item_name, score: 1.0,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
            suggestions: exactCodeMatches.map(m => withPrice({
              item_no: m.item_no, item_name: m.item_name, score: 1.0,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
          });
          continue;
        }

        // ✅ 접두사 매칭: "0884/0" → "0884/0", "0884/07" 등 (인덱스 기반)
        const prefixCodeMatches = findByPrefix(inputItemNo);

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
            results.push({
              ...it,
              normalized_query: it.name,
              resolved: true,
              item_no: best.item_no,
              item_name: best.item_name,
              score: 1.0,
              method: "prefix_rd_code",
              candidates: sorted.map(m => withPrice({
                item_no: m.item_no, item_name: m.item_name, score: 1.0,
                in_client_history: clientRows.some(r => r.item_no === m.item_no),
              })),
              suggestions: sorted.map(m => withPrice({
                item_no: m.item_no, item_name: m.item_name, score: 1.0,
                in_client_history: clientRows.some(r => r.item_no === m.item_no),
              })),
            });
            continue;
          }

          // 여러 개이거나 거래처 이력에 없으면 확인필요
          results.push({
            ...it,
            normalized_query: it.name,
            resolved: false,
            item_no: best.item_no,
            item_name: best.item_name,
            score: 0.95,
            method: prefixCodeMatches.length === 1 ? "prefix_rd_code" : "prefix_rd_code_multi",
            not_in_client_history: !bestInClientHistory,
            candidates: sorted.map(m => withPrice({
              item_no: m.item_no, item_name: m.item_name, score: 0.95,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
            suggestions: sorted.map(m => withPrice({
              item_no: m.item_no, item_name: m.item_name, score: 0.95,
              in_client_history: clientRows.some(r => r.item_no === m.item_no),
            })),
          });
          continue;
        }

        // ✅ 폴백: Supabase ilike 검색 (RD 없이 숫자만 입력한 경우)
        // 1) 거래처 이력에서 품목명 내부 번호로 검색
        const { data: clientGlassData } = await supabase
          .from('glass_client_item_stats')
          .select('item_no, item_name')
          .eq('client_code', clientCode)
          .or(`item_name.ilike.%RD ${inputItemNo}%,item_name.ilike.%RD ${inputItemNo.replace(/\//g, '-')}%,item_name.ilike.%RD ${inputItemNo.replace(/[\/-]/g, '')}%`)
          .limit(1);
        const clientGlass = clientGlassData?.[0] as any;

        if (clientGlass) {
          console.log(`[Glass Pattern] ✅ 거래처 이력에서 와인잔 발견: ${clientGlass.item_no} - ${clientGlass.item_name}`);
          results.push({
            ...it,
            normalized_query: it.name,
            resolved: true,
            item_no: clientGlass.item_no,
            item_name: clientGlass.item_name,
            score: 1.0,
            method: "glass_pattern_client",
            candidates: [withPrice({ item_no: clientGlass.item_no, item_name: clientGlass.item_name, score: 1.0, in_client_history: true })],
            suggestions: [withPrice({ item_no: clientGlass.item_no, item_name: clientGlass.item_name, score: 1.0, in_client_history: true })],
          });
          continue;
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
          results.push({
            ...it,
            normalized_query: it.name,
            resolved: false,
            item_no: masterGlass.item_no,
            item_name: masterGlass.item_name,
            score: 0.95,
            method: "glass_pattern_master",
            not_in_client_history: true,
            candidates: [withPrice({ item_no: masterGlass.item_no, item_name: masterGlass.item_name, score: 0.95, in_client_history: false })],
            suggestions: [withPrice({ item_no: masterGlass.item_no, item_name: masterGlass.item_name, score: 0.95, in_client_history: false })],
          });
          continue;
        }
      } catch (e) {
        console.error('[Glass Pattern] 와인잔 패턴 검색 실패:', e);
      }

      console.log(`[Glass ItemNo Exact] ❌ 와인잔 품목번호를 찾을 수 없음: ${inputItemNo}`);
    }

    // ✅ 1순위: 코드가 있으면 코드로 정확히 매칭 (전체 품목에서 검색)
    if (it.code) {
      // ✅ 정확 매칭 우선 (0425/0 == 0425/00 포함) — 인덱스 기반
      const codeMatches = findByCode(it.code!);

      if (codeMatches.length > 0) {
        const clientHits = codeMatches.filter(m => clientRows.some(r => r.item_no === m.item_no));
        const best = clientHits[0] || codeMatches[0];
        const inClientHistory = clientHits.length > 0;
        const isDuplicateCode = codeMatches.length > 1;
        const canAutoResolve = inClientHistory && (!isDuplicateCode || clientHits.length === 1);

        console.log(`[Glass] 1순위 exact_code: ${best.item_no} (거래처이력: ${inClientHistory}, 중복: ${isDuplicateCode}, 자동확정: ${canAutoResolve})`);

        results.push({
          ...it,
          normalized_query: it.code,
          resolved: canAutoResolve,
          item_no: best.item_no,
          item_name: best.item_name,
          score: canAutoResolve ? 1.0 : 0.95,
          method: "exact_code",
          not_in_client_history: !inClientHistory,
          candidates: codeMatches.map(m => withPrice({
            item_no: m.item_no,
            item_name: m.item_name,
            score: 1.0,
            in_client_history: clientRows.some(r => r.item_no === m.item_no),
          })),
          suggestions: codeMatches.map(m => withPrice({
            item_no: m.item_no,
            item_name: m.item_name,
            score: 1.0,
            in_client_history: clientRows.some(r => r.item_no === m.item_no),
          })),
        });
        continue;
      }
    }

    // ✅ 1.5순위: 품목명 안에 코드 패턴이 숨어있는 경우 추출하여 매칭
    // 예: "크로스비 0425/0" → 코드 0425/0 추출, "330/07" → 0330/07
    if (!it.code) {
      const embeddedCodeMatch = it.name.match(/(\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
      if (embeddedCodeMatch) {
        const embeddedCode = normalizeGlassCode(embeddedCodeMatch[1]);
        console.log(`[Glass] 1.5순위: 품목명에서 코드 추출: "${embeddedCode}" (from "${it.name}")`);

        // 인덱스 기반 정확 매칭
        const embeddedMatches = findByCode(embeddedCode);
        const codeMatch = embeddedMatches[0];

        if (codeMatch) {
          const inHistory = clientRows.some(r => r.item_no === codeMatch.item_no);
          console.log(`[Glass] 1.5순위 ✅ 코드 매칭: ${codeMatch.item_no} - ${codeMatch.item_name} (거래처이력: ${inHistory})`);
          results.push({
            ...it,
            normalized_query: embeddedCode,
            resolved: inHistory,
            item_no: codeMatch.item_no,
            item_name: codeMatch.item_name,
            score: inHistory ? 1.0 : 0.95,
            method: "embedded_code",
            not_in_client_history: !inHistory,
            candidates: [withPrice({ item_no: codeMatch.item_no, item_name: codeMatch.item_name, score: 1.0, in_client_history: inHistory })],
            suggestions: [withPrice({ item_no: codeMatch.item_no, item_name: codeMatch.item_name, score: 1.0, in_client_history: inHistory })],
          });
          continue;
        }

        // 인덱스 기반 접두사 매칭
        const prefixMatches = findByPrefix(embeddedCode);

        if (prefixMatches.length === 1) {
          const best = prefixMatches[0];
          const inHistory = clientRows.some(r => r.item_no === best.item_no);
          console.log(`[Glass] 1.5순위 ✅ 접두사 매칭 (1개): ${best.item_no} - ${best.item_name}`);
          results.push({
            ...it,
            normalized_query: embeddedCode,
            resolved: inHistory,
            item_no: best.item_no,
            item_name: best.item_name,
            score: inHistory ? 1.0 : 0.95,
            method: "embedded_prefix_code",
            not_in_client_history: !inHistory,
            candidates: prefixMatches.map(m => withPrice({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
            suggestions: prefixMatches.map(m => withPrice({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
          });
          continue;
        }

        if (prefixMatches.length > 1) {
          const sorted = prefixMatches.sort((a, b) => {
            const aClient = clientRows.some(r => r.item_no === a.item_no) ? 1 : 0;
            const bClient = clientRows.some(r => r.item_no === b.item_no) ? 1 : 0;
            return bClient - aClient;
          });
          console.log(`[Glass] 1.5순위 ⚠️ 접두사 매칭 ${prefixMatches.length}개 → 후보 제시`);
          results.push({
            ...it,
            normalized_query: embeddedCode,
            resolved: false,
            candidates: sorted.map(m => withPrice({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
            suggestions: sorted.map(m => withPrice({ item_no: m.item_no, item_name: m.item_name, score: 0.95, in_client_history: clientRows.some(r => r.item_no === m.item_no) })),
          });
          continue;
        }
      }
    }

    // ✅ 1.8순위: 비-RD 품목 키워드 매칭 (마닐라박스, 쇼핑백, 린넨 등)
    const nonRDMatch = matchNonRDItem(it.name);
    if (nonRDMatch) {
      const inHistory = clientRows.some(r => r.item_no === nonRDMatch.item_no);
      console.log(`[Glass] 1.8순위 ✅ 비-RD 품목 매칭: ${nonRDMatch.item_no} - ${nonRDMatch.item_name} (score: ${nonRDMatch.score})`);
      results.push({
        ...it,
        normalized_query: it.name,
        resolved: inHistory,
        item_no: nonRDMatch.item_no,
        item_name: nonRDMatch.item_name,
        score: nonRDMatch.score,
        method: "non_rd_keyword",
        not_in_client_history: !inHistory,
        candidates: [withPrice({ item_no: nonRDMatch.item_no, item_name: nonRDMatch.item_name, score: nonRDMatch.score, in_client_history: inHistory })],
        suggestions: [withPrice({ item_no: nonRDMatch.item_no, item_name: nonRDMatch.item_name, score: nonRDMatch.score, in_client_history: inHistory })],
      });
      continue;
    }

    // ✅ 2순위: 검색어 확장 (토큰 매핑 학습 활용)
    const cleanName = stripQtyAndUnit(it.name);
    const expansion = await expandQuery(cleanName, 0.5);
    logQueryExpansion(expansion);

    const learned = await getLearnedMatch(it.name, clientCode);
    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // 마스터 후보 (원본 + 확장된 검색어) - 멀티 토큰 검색
    const masterRows1 = await fetchFromGlassMasterByTokens(it.name, 40);
    const masterRows2 = expansion.hasExpansion
      ? await fetchFromGlassMasterByTokens(expansion.expanded, 40)
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
      let hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      // ✅ 풀에 없으면 DB에서 직접 조회 (학습된 약어 → 품목번호 매핑)
      if (!hit) {
        const { data: dbRow } = await supabase
          .from('glass_items')
          .select('item_no, item_name')
          .eq('item_no', learnedItemNo)
          .limit(1)
          .maybeSingle();
        if (dbRow) hit = { item_no: String(dbRow.item_no), item_name: String(dbRow.item_name) };
      }
      if (hit) {
        console.log(`[Learn] ✅ alias_exact 매칭: "${it.name}" → ${hit.item_no} ${hit.item_name}`);
        results.push({
          ...it,
          normalized_query: norm(it.name),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 1.0,
          method: "alias_exact_item_no",
          candidates: [],
          suggestions: [],
        });
        continue;
      }
    }

    // 2) contains_specific 학습이면 하드 확정
    if (learned && learned.kind === "contains_specific" && learnedItemNo) {
      let hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      // ✅ 풀에 없으면 DB에서 직접 조회
      if (!hit) {
        const { data: dbRow } = await supabase
          .from('glass_items')
          .select('item_no, item_name')
          .eq('item_no', learnedItemNo)
          .limit(1)
          .maybeSingle();
        if (dbRow) hit = { item_no: String(dbRow.item_no), item_name: String(dbRow.item_name) };
      }
      if (hit) {
        console.log(`[Learn] ✅ alias_contains_specific 매칭: "${it.name}" → ${hit.item_no} ${hit.item_name}`);
        results.push({
          ...it,
          normalized_query: norm(it.name),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 0.99,
          method: "alias_contains_specific_item_no",
          candidates: [],
          suggestions: [],
        });
        continue;
      }
    }

    // 3) 🎯 조합 가중치 시스템으로 점수 계산
    const q = norm(stripQtyAndUnit(it.name));
    const qExpanded = expansion.hasExpansion ? norm(expansion.expanded) : q;

    const scored: Array<{
      item_no: string;
      item_name: string;
      score: number;
      _debug?: any;
    }> = [];

    for (const r of pool) {
      // 원본 쿼리 점수
      const score1 = scoreItem(q, r.item_name);

      // 확장된 쿼리 점수 (학습 효과)
      const score2 = expansion.hasExpansion ? scoreItem(qExpanded, r.item_name) : 0;

      // 최고 점수 선택 (확장 검색은 20% 부스트)
      const baseScore = Math.max(score1, score2 * 1.2);

      // 🎯 가중치 시스템으로 최종 점수 계산
      const weighted = await calculateWeightedScore(
        it.name,
        clientCode,
        String(r.item_no),
        baseScore,
        'glass' // Glass 전용 테이블 지정
      );

      scored.push({
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
      });
    }

    scored.sort((a, b) => b.score - a.score);

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
      results.push({
        ...it,
        normalized_query: q,
        resolved: true,
        item_no: top.item_no,
        item_name: top.item_name,
        score: Number(top.score.toFixed(3)),
        method: learned?.kind ? `weighted+${learned.kind}` : "weighted",
        candidates: scored.slice(0, topN).map((c) => withPrice({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
          in_client_history: clientRows.some(r => r.item_no === c.item_no),
          _debug: (c as any)._debug,
        })),
        suggestions: (() => {
          // 자동확정이어도 신규품목 함께 표시
          const existingTop = scored.slice(0, 10).map((c) => withPrice({
            item_no: c.item_no,
            item_name: c.item_name,
            score: Number(c.score.toFixed(3)),
            in_client_history: clientRows.some(r => r.item_no === c.item_no),
          }));

          const newItems = searchNewGlassFromRiedel(q).map(item => ({
            item_no: item.code,
            item_name: item.item_name,
            score: Number(item.score.toFixed(3)),
            is_new_item: true,
            price: item.price,
          }));

          const combined = [...existingTop, ...newItems.slice(0, 5)];
          console.log('[DEBUG Glass] Auto-resolved suggestions:', { existing: existingTop.length, new: newItems.length });
          return combined;
        })(),
      });
      continue;
    }

    // ✅ 항상 기존품목 + 신규품목 함께 표시 (Glass는 신규품목 확인이 중요)
    console.log('[DEBUG Glass] Building suggestions for:', q);
    const suggestions = (() => {
      // 기존품목 상위 10개 (supply_price 포함)
      const existingTop = scored.slice(0, 10).map((c) => withPrice({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
        in_client_history: clientRows.some(r => r.item_no === c.item_no),
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
      const combined = [...existingTop, ...newItems.slice(0, 5)];

      console.log('[DEBUG Glass] 후보 조합:', {
        existing: existingTop.length,
        newItems: newItems.length,
        combined: combined.length,
        topScore: top?.score,
        items: combined.map(c => ({ code: c.item_no, score: c.score, isNew: (c as any).is_new_item, price: (c as any).price }))
      });

      return combined;
    })();

    results.push({
      ...it,
      normalized_query: q,
      resolved: false,
      candidates: scored.slice(0, topN).map((c) => withPrice({
        item_no: c.item_no,
        item_name: c.item_name,
        score: Number(c.score.toFixed(3)),
        in_client_history: clientRows.some(r => r.item_no === c.item_no),
        _debug: (c as any)._debug,
      })),
      suggestions,
    });
  }

  return results;
}
