/**
 * ========================================
 * 조합 가중치 기반 품목 매칭 시스템
 * ========================================
 *
 * resolveItems.ts의 가중치 시스템 버전
 * 여러 신호를 종합해서 정교한 매칭 수행
 *
 * ✅ 부분 토큰 매칭 추가 (2026-01-19)
 * ✅ 신규 품목 검색 통합 (2026-01-19)
 * ✅ 생산자 필터링 비활성화 (2026-01-19)
 * ✅ 다단계 토큰 매칭 추가 (2026-01-30) - 루이미셸 샤블리 검색 개선
 */

import { supabase } from "@/app/lib/db";
import { applyItemSynonym } from "@/app/lib/itemsynonyms";
import { calculateWeightedScoreCached, preloadScoringData, type PreloadedScoringData } from "@/app/lib/weightedScoring";
import { searchMasterSheet } from "@/app/lib/masterMatcher";
import { ITEM_MATCH_CONFIG } from "@/app/lib/itemMatchConfig";
import { expandQuery, logQueryExpansion, generateQueryVariations } from "@/app/lib/queryExpander";
import { preprocessNaturalLanguage, normalizeProducers } from "@/app/lib/naturalLanguagePreprocessor";
import { loadAllMasterItems, getDownloadsPriceMap } from "@/app/lib/masterSheet";
import { multiLevelTokenMatch } from "@/app/lib/multiLevelTokenMatcher";
import { findItemCodeFromEnglish, findMultipleFromEnglish } from "@/app/lib/englishSheetMatcher";

/* ================= 와인 토큰 동의어 (스코어링 전용) ================= */
// 다국어 와인 용어를 그룹화 — 같은 그룹의 토큰은 매칭 시 동일하게 취급
const WINE_TOKEN_SYNONYM_GROUPS: string[][] = [
  ["블랑", "브랑코", "blanc", "branco", "bianco", "blanco"],  // 화이트
  ["루즈", "틴토", "로쏘", "rouge", "tinto", "rosso"],        // 레드
  ["로제", "로사도", "rosé", "rosado", "rosato"],             // 로제
  ["리저브", "리제르바", "레세르바", "reserve", "reserva", "riserva"],
  ["크뤼", "크루", "cru"],
  ["그랑", "그란", "grand", "gran", "grande"],
];

// 빠른 조회용 맵: 토큰 → 그룹 내 모든 동의어
const _tokenSynonymMap = new Map<string, Set<string>>();
for (const group of WINE_TOKEN_SYNONYM_GROUPS) {
  const allNorm = group.map(t => t.toLowerCase());
  for (const t of allNorm) {
    _tokenSynonymMap.set(t, new Set(allNorm));
  }
}

/** 두 토큰이 와인 동의어인지 확인 */
function areTokenSynonyms(a: string, b: string): boolean {
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  if (aLow === bLow) return true;
  const group = _tokenSynonymMap.get(aLow);
  return !!group && group.has(bLow);
}

/* ================= 정규화 함수 ================= */

function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    // ✅ 곡선 따옴표 통일
    .replace(/["\u201c\u201d]/g, '"')
    .replace(/['\u2018\u2019]/g, "'")
    // ✅ 악센트 제거
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  // Chablis
  t = t.replace(/\bchablis\b/gi, "샤블리");

  // Louis Michel (생산자)
  t = t.replace(/\blouis\s+michel\b/gi, "루이미셸");
  t = t.replace(/\blouis\b/gi, "루이");
  t = t.replace(/\bmichel\b/gi, "미셸");
  t = t.replace(/미쉘/g, "미셸"); // 오타 수정: 미쉘 → 미셸

  // Montee de tonnerre (프리미엄 크뤼)
  t = t.replace(/\bmontée\s+de\s+tonnerre\b/gi, "몬테드토네흐");
  t = t.replace(/\bmontee\s+de\s+tonnerre\b/gi, "몬테드토네흐");
  t = t.replace(/\bmontée\b/gi, "몬테");
  t = t.replace(/\bmontee\b/gi, "몬테");
  t = t.replace(/\btonnerre\b/gi, "토네흐");

  return t;
}

function norm(s: string) {
  return normalizeItemName(s)
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

/* ================= 복합 토큰 분해 매칭 ================= */

/**
 * 알려진 와인 품종/산지/용어를 기반으로 공백 없이 붙여쓴 한글 쿼리를 분해
 * 예: "아이니샤르도네" → ["아이니", "샤르도네"]
 * 예: "후플라카베르네소비뇽" → ["후플라", "카베르네소비뇽"]
 */
const KNOWN_WINE_TOKENS = [
  // 품종 (길이 내림차순 - 긴 것 먼저 매칭)
  '카베르네소비뇽', '소비뇽블랑', '피노누아', '샤르도네', '리슬링',
  '메를로', '시라', '말벡', '그르나슈', '피노그리', '피노블랑',
  '템프라니요', '산지오베제', '네비올로', '무르베드르', '비오니에',
  '게뷔르츠트라미너', '블랑드블랑', '블랑드누아',
  // 산지/유형
  '샤블리', '부르고뉴', '보르도', '상세르', '프이퓌세', '뫼르소',
  '볼네양보', '본로마네', '사비니레본', '뉘생조르쥬',
  '그랑크뤼', '프르미에크뤼', '비에유비뉴',
  // 일반 용어
  '블랑', '루즈', '로제', '레드', '화이트', '브뤼', '나뛰르',
  '레제르브', '그랑레제르브', '퀴베',
];

function decomposeCompoundKorean(normalizedQuery: string): string[] {
  let remaining = normalizedQuery;
  const tokens: string[] = [];

  // 알려진 토큰을 길이 내림차순으로 검색하여 추출
  for (const token of KNOWN_WINE_TOKENS) {
    const idx = remaining.indexOf(token);
    if (idx !== -1) {
      // 토큰 앞부분이 있으면 추가
      const before = remaining.substring(0, idx);
      if (before.length >= 2) {
        tokens.push(before);
      }
      tokens.push(token);
      remaining = remaining.substring(idx + token.length);
    }
  }

  // 남은 부분이 있으면 추가
  if (remaining.length >= 2) {
    tokens.push(remaining);
  }

  return tokens.length >= 2 ? tokens : [];
}

/**
 * 복합 토큰 분해 후 매칭 점수 계산
 * 모든 토큰이 후보 품목명에 존재하면 높은 점수, 일부만 있으면 낮은 점수
 */
function scoreCompoundTokenMatch(normalizedQuery: string, normalizedTarget: string): number {
  const tokens = decomposeCompoundKorean(normalizedQuery);
  if (tokens.length < 2) return 0;

  let matchedCount = 0;
  for (const token of tokens) {
    if (normalizedTarget.includes(token)) {
      matchedCount++;
    }
  }

  const recall = matchedCount / tokens.length;

  if (recall >= 1.0) {
    // 모든 토큰이 후보에 존재 → 0.95 (강력한 신호)
    // 예: "아이니" + "샤르도네" 모두 있음 = 거의 확실
    return 0.95;
  } else if (recall >= 0.5) {
    // 절반 이상 매칭: 예) "샤르도네"만 있고 "아이니"는 없음
    return 0.55 + (recall * 0.15);
  }

  return 0;
}

/* ================= 빈티지 힌트 ================= */

export function hasVintageHint(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b\d{2}\b/.test(text);
}

/* ================= 생산자 감지 ================= */

// order-ai.xlsx English 시트에서 자동 추출 (71개 생산자)
// 마지막 업데이트: 2026-01-16
const WINE_PRODUCERS = [
  // Argentina (1개)
  'chakana', '차카나',

  // Australia (1개)
  'robert oatley', '로버트 오틀리',

  // Chile (1개)
  'emiliana', '에밀리아나',

  // England (1개)
  'rathfinny', '라피니',

  // France (27개)
  'charles heidsieck', '찰스 하이직', '샤를 에드시크',
  'chateau favori', '샤또 파보리',
  'chateau grand-jauga', '샤또 그랑 주가',
  'chateau maillet', '샤또 마이에',
  'chateau marechaux', '샤또 마레쇼', '샤또 레마레쇼',
  'chateau de la gardine', '샤또 드 라 가르딘',
  'christophe pitois', '크리스토프 피뚜아',
  'clement lavallee', '클레멍 라발리', '클레멍라발레', 'cl',
  'couly dutheil', '꿀리 뒤떼이',
  'domaine clos de la chapel', '도멘 클로 드 라 샤펠',
  'domaine guy yvan et dufouleur', '도멘 기 이반 뒤폴레르', '도멘기이반',
  'domaine jean-paul picard', '도멘 장폴 피카르',
  'domaine leroy', '도멘 르로아',
  'domaine vieux college', '도멘 비욱 꼴레쥬',
  "domaine d'auvenay", '도멘 도브네',
  'dopff au moulin', '도프',
  'leguillette-romelot', '레귀에뜨 로믈로',
  'les dauphins', '레 도팡', '도팡',
  'louis michel et fils', '루이 미셸',
  'maison leroy', '메종 르로아',
  'mas des infirmieres', '마스 데 앙페미에르',
  'roche de bellene', '로쉬 벨렌', '로쉬벨렌',
  'rodolphe demougeot', '로돌프 드모조',
  'roger belland', '로저 벨랑',
  'soutiran', '수티랑',
  'veuve ambal', '뵈브 암발',
  'vincent girardin', '뱅상 지라르댕',

  // Italy (10개)
  'altesino', '알테시노',
  'anselmi', '안셀미',
  'biondi santi', '비온디 산티', '비온디산티',
  'borgo molino', '보르고 몰리노',
  'cascina adelaide', '카시나 아델라이데',
  'castello di volpaia', '카스텔로 디 볼파이아',
  'elena fucci', '엘레나 푸치',
  'i greppi', '이 그렙피',
  'pelassa', '펠라사',
  "tenuta dell'ornellaia", '테누타 델 오르넬라이아', '오르넬라이아',

  // NewZealand (1개)
  'lake chalice', '레이크 샬리스', '레이크찰리스', '팔콘', 'falcon',

  // Portugal (5개)
  "blandy's madeira", '블랜디스 마데이라',
  'conceito', '콘세이토',
  "graham's port", '그레엄스 포트',
  'luis seabra xisto', '루이스 세아브라 시스투',
  'symington family estate', '시밍턴 패밀리',

  // Spain (4개)
  'juve y camps', '주베 이 캄프스',
  'mas martinet', '마스 마르티넷',
  'sentir', '센티르',
  'sumarroca', '수마로카',

  // USA (20개)
  'addendum', '애덴덤',
  'alma rosa', '알마 로사',
  'cru winery', '크루 와이너리', '크뤼 와이너리',
  'fess parker', '페스 파커',
  'fog & light', '포그 앤 라이트',
  'gallica', '갈리카',
  'gamble family vineyards', '갬블 패밀리',
  'hoopes', '후프스',
  'lamborn family vineyards', '램본 패밀리',
  'lange twins', '랑게 트윈스',
  'mathew bruno', '매튜 브루노',
  'peter franus', '피터 프래너스',
  'pisoni', '피소니',
  'priest ranch', '프리스트 랜치',
  'reata', '리아타',
  'red car', '레드 카',
  'relic', '렐릭',
  'ridge', '릿지',
  'silver spur', '실버 스퍼',
  'small vines', '스몰 바인스',

  // 추가 일반 키워드
  'chateau', 'domaine', 'maison', '샤또', '도멘', '메종',
  'ch', 'dom', 'cl'
];

// 생산자 캐시 (DB에서 동적 로드용 - 추후 구현)
let producerCache: string[] | null = null;

// DB에서 생산자 목록 로드 (item_alias 테이블 활용)
async function loadProducersFromDB(): Promise<string[]> {
  try {
    // item_alias에서 생산자로 추정되는 별칭 추출
    // 3글자 이상이고, 사용 빈도 5회 이상인 것만
    const { data: rows } = await supabase
      .from('item_alias')
      .select('alias, canonical, count')
      .gte('count', 5)
      .order('count', { ascending: false })
      .limit(100);

    // Filter in JS for the LIKE conditions
    const filteredRows = (rows || []).filter((row: any) => {
      const alias = String(row.alias || '').toLowerCase();
      const canonical = String(row.canonical || '').toLowerCase();
      const keywords = ['산티', '샤토', '도멘', '알테', '가야', '바롤로', '비온디', '메종', '릿지'];
      return keywords.some(kw => alias.includes(kw) || canonical.includes(kw)) && alias.length >= 3;
    }) as Array<{ alias: string; canonical: string; count: number }>;

    const producers = new Set<string>();

    filteredRows.forEach(row => {
      // alias와 canonical 모두 추가
      if (row.alias.length >= 3) {
        producers.add(row.alias.toLowerCase());
      }
      if (row.canonical.length >= 3) {
        producers.add(row.canonical.toLowerCase());
      }
    });

    const result = Array.from(producers);
    console.log(`[Producer DB] 로드된 생산자 ${result.length}개:`, result.slice(0, 10));
    return result;
  } catch (e) {
    console.error('[Producer DB] 로드 실패:', e);
    return [];
  }
}

// 통합 생산자 목록 (정적 + 동적)
async function getAllProducers(): Promise<string[]> {
  if (producerCache) {
    return producerCache;
  }

  // DB에서 동적 로드 + 정적 리스트 합치기
  const dbProducers = await loadProducersFromDB();
  const allProducers = [...WINE_PRODUCERS, ...dbProducers];

  // 중복 제거
  producerCache = Array.from(new Set(allProducers.map(p => p.toLowerCase())));

  console.log(`[Producer] 전체 생산자 목록: ${producerCache.length}개`);
  return producerCache;
}

async function detectProducer(rawName: string): Promise<{ hasProducer: boolean; producer: string }> {
  const lowerName = rawName.toLowerCase().trim();
  const producers = await getAllProducers(); // 통합 생산자 목록 사용

  // 1단계: 전체 문자열에서 생산자 검색 (더 긴 매칭 우선)
  let longestMatch = '';
  let matchedProducer = '';

  for (const p of producers) {
    const pLower = p.toLowerCase();

    // 전체 문자열에 생산자명 포함 여부 확인
    if (lowerName.includes(pLower)) {
      // 더 긴 매칭을 우선
      if (pLower.length > longestMatch.length) {
        longestMatch = pLower;

        // 원본 문자열에서 해당 부분 추출
        const startIdx = lowerName.indexOf(pLower);
        const endIdx = startIdx + pLower.length;

        // 공백으로 구분된 토큰 찾기 (생산자명 전체 추출)
        const tokens = rawName.trim().split(/\s+/);
        for (const token of tokens) {
          if (token.toLowerCase().includes(pLower)) {
            matchedProducer = token;
            break;
          }
        }

        // 토큰에서 못 찾으면 직접 추출
        if (!matchedProducer) {
          matchedProducer = rawName.substring(startIdx, endIdx);
        }
      }
    }
  }

  if (matchedProducer) {
    console.log(`[Wine] 🏭 생산자 감지: "${matchedProducer}" (패턴: "${longestMatch}", 원본: "${rawName}")`);
    return { hasProducer: true, producer: matchedProducer };
  }

  // 2단계: 첫 번째 토큰에서 생산자 검색 (기존 로직)
  const tokens = rawName.trim().split(/\s+/);
  if (tokens.length === 0) return { hasProducer: false, producer: '' };

  const firstToken = tokens[0].toLowerCase();
  const matched = producers.find(p =>
    firstToken.includes(p.toLowerCase()) || p.toLowerCase().includes(firstToken)
  );

  if (matched) {
    console.log(`[Wine] 🏭 생산자 감지 (첫토큰): "${tokens[0]}" (패턴: ${matched})`);
    return { hasProducer: true, producer: tokens[0] };
  }

  return { hasProducer: false, producer: '' };
}

/* ================= 점수 계산 ================= */

function scoreItem(q: string, name: string, options?: { producer?: string }) {
  // 생산자 필터링 (생산자가 명시된 경우)
  if (options?.producer) {
    const producerNorm = normTight(options.producer);
    const nameNorm = normTight(name);

    // 생산자가 품목명에 없으면 0점 처리
    if (!nameNorm.includes(producerNorm)) {
      console.log(`[Wine] ❌ 생산자 불일치: "${options.producer}" not in "${name}"`);
      return 0;
    }

    console.log(`[Wine] ✅ 생산자 일치: "${options.producer}" in "${name}"`);
  }

  // 🎯 모든 매칭 점수를 계산 후 최댓값 반환
  let bestScore = 0;

  // 1️⃣ 다단계 토큰 매칭 (2026-01-30 추가)
  // 루이미셸, 샤블리 등 다양한 브랜드 검색 개선
  const multiLevelScore = multiLevelTokenMatch(q, name);
  bestScore = Math.max(bestScore, multiLevelScore);

  // 2️⃣ 영문 단어 매칭 우선 (3글자 이상 영어 단어가 있으면)
  const qEnglishWords = (q.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());
  const nameEnglishWords = (name.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());

  if (qEnglishWords.length >= 2 && nameEnglishWords.length >= 2) {
    const qSet = new Set(qEnglishWords);
    const nameSet = new Set(nameEnglishWords);
    const intersection = Array.from(qSet).filter(w => nameSet.has(w));

    // 3개 이상 매칭되면 높은 점수
    if (intersection.length >= 3) {
      const recall = intersection.length / qSet.size;
      const precision = intersection.length / nameSet.size;
      const englishScore = Math.min(0.95, (recall + precision) / 2 + 0.2);
      bestScore = Math.max(bestScore, englishScore);
    }
    // 2개 이상 매칭
    else if (intersection.length >= 2) {
      const recall = intersection.length / qSet.size;
      const englishScore = Math.min(0.85, recall + 0.3);
      bestScore = Math.max(bestScore, englishScore);
    }
  }

  // 3️⃣ 토큰 기반 매칭 (별칭 확장 대응 + 부분 매칭)
  const qTokens = q.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = name.toLowerCase().split(/\s+/).filter(t => t.length >= 2);

  if (qTokens.length >= 2 && nameTokens.length >= 1) {
    const qSet = new Set(qTokens);
    const nameSet = new Set(nameTokens);

    let matchedQTokens = 0;
    let matchedNameTokens = 0;

    for (const qt of qTokens) {
      let found = false;

      // 정확 매칭 체크
      if (nameSet.has(qt)) {
        matchedQTokens++;
        matchedNameTokens++;
        found = true;
        continue;
      }

      // 와인 동의어 매칭 체크 (블랑↔브랑코, 루즈↔틴토 등)
      for (const nt of nameTokens) {
        if (areTokenSynonyms(qt, nt)) {
          matchedQTokens += 0.95;
          matchedNameTokens += 0.95;
          found = true;
          break;
        }
      }
      if (found) continue;

      // 부분 매칭 체크
      const qtNorm = normTight(qt);
      let combined = "";
      for (const nt of nameTokens) {
        combined += normTight(nt);
        if (combined === qtNorm) {
          matchedQTokens++;
          matchedNameTokens += combined.length / normTight(nt).length;
          found = true;
          break;
        }
        if (qtNorm.includes(combined) || combined.includes(qtNorm)) {
          matchedQTokens += 0.8;
          matchedNameTokens += 0.8;
          found = true;
          break;
        }
      }

      // 반대 방향 체크
      if (!found) {
        for (const nt of nameTokens) {
          const ntNorm = normTight(nt);
          if (qtNorm.includes(ntNorm) && ntNorm.length >= 3) {
            matchedQTokens += 0.5;
            matchedNameTokens += 0.5;
            break;
          }
        }
      }
    }

    if (matchedQTokens > 0) {
      const recall = matchedQTokens / qTokens.length;
      const precision = matchedNameTokens / nameTokens.length;

      let tokenScore = 0;
      if (recall >= 0.8) {
        tokenScore = Math.min(0.95, 0.80 + (recall * 0.15) + (precision * 0.05));
      } else if (recall >= 0.6) {
        tokenScore = Math.min(0.85, 0.65 + (recall * 0.20));
      } else if (recall >= 0.5) {
        tokenScore = Math.min(0.75, 0.55 + (recall * 0.20));
      }

      bestScore = Math.max(bestScore, tokenScore);
    }
  }

  // 4️⃣ 기존 한글 정규화 로직
  const a = norm(q);
  const b = norm(name);
  if (a && b) {
    if (a === b) {
      bestScore = Math.max(bestScore, 1.0);
    } else if (b.includes(a) || a.includes(b)) {
      bestScore = Math.max(bestScore, 0.9);
    } else {
      const aset = new Set(a.split(""));
      let common = 0;
      for (const ch of Array.from(aset)) if (b.includes(ch)) common++;
      const rawCharScore = common / Math.max(6, a.length);
      // 복합 토큰 분해가 가능하면 charSet 상한을 0.70으로 제한
      // (compound 매칭이 더 정확한 점수를 제공하므로)
      const compoundTokens = decomposeCompoundKorean(a);
      const charCap = compoundTokens.length >= 2 ? 0.70 : 0.89;
      const charScore = Math.min(charCap, rawCharScore);
      bestScore = Math.max(bestScore, charScore);
    }
  }

  // 5️⃣ 복합 토큰 분해 매칭 (아이니샤르도네 → "아이니" + "샤르도네")
  // 공백 없이 붙여쓴 한글 쿠리를 와인 품종/산지/생산자 토큰으로 분해하여
  // 모든 토큰이 후보 품목명에 존재하는지 확인
  if (a && b && !b.includes(a) && !a.includes(b)) {
    const compoundScore = scoreCompoundTokenMatch(a, b);
    bestScore = Math.max(bestScore, compoundScore);
  }

  return bestScore;
}

/* ================= 마스터에서 후보 확장 ================= */

/**
 * 모든 유효한 토큰 추출 (기존: 꼬리 2개만 → 개선: 모든 토큰)
 */
function getAllTokens(rawName: string): string[] {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));

  return clean;
}

/**
 * 멀티 토큰 검색: AND + Half + OR 전략
 * 1. AND 검색: 모든 토큰 포함 (가장 정확)
 * 2. Half 검색: 절반 이상 토큰 포함 (중간 정확도)
 * 3. OR 검색: 하나라도 포함 (넓은 범위)
 */
async function fetchFromMasterByTail(rawName: string, limit = 80): Promise<Array<{ item_no: string; item_name: string }>> {
  // inventory_cdv 테이블 사용 (기존 'items' 테이블은 Supabase에 없음)
  const table = 'inventory_cdv';
  const itemNoCol = 'item_no';
  const itemNameCol = 'item_name';

  const tokens = getAllTokens(rawName);
  if (tokens.length === 0) return [] as Array<{ item_no: string; item_name: string }>;

  // 와인 동의어 확장: 각 토큰의 동의어를 SQL 검색에 포함
  function getTokenWithSynonyms(token: string): string[] {
    const synonyms = _tokenSynonymMap.get(token.toLowerCase());
    return synonyms ? Array.from(synonyms) : [token];
  }

  // 동의어 포함 AND 매칭: 각 토큰이 원본 또는 동의어로 매칭되는지 확인
  function matchesAllTokensWithSynonyms(itemName: string, checkTokens: string[]): boolean {
    const nameLower = itemName.toLowerCase();
    return checkTokens.every(t => {
      if (nameLower.includes(t.toLowerCase())) return true;
      const syns = _tokenSynonymMap.get(t.toLowerCase());
      if (syns) {
        for (const syn of syns) {
          if (nameLower.includes(syn)) return true;
        }
      }
      return false;
    });
  }

  try {
    const results = new Map<string, { item_no: string; item_name: string; priority: number }>();

    // 전략 1: AND 검색 (모든 토큰 포함) - 최고 우선순위
    if (tokens.length >= 2) {
      try {
        // 동의어 확장된 OR 필터 (SQL에서 더 넓은 범위 검색)
        const expandedTokens = tokens.flatMap(t => getTokenWithSynonyms(t));
        const uniqueTokens = [...new Set(expandedTokens)];
        const orFilter = uniqueTokens.map(t => `${itemNameCol}.ilike.%${t}%`).join(',');
        const { data } = await supabase
          .from(table)
          .select(`${itemNoCol}, ${itemNameCol}`)
          .or(orFilter)
          .limit(500);
        // Filter in JS: 각 원본 토큰이 (원본 또는 동의어로) 매칭되는지 확인
        const andResults = (data || []).filter((r: any) =>
          matchesAllTokensWithSynonyms(String(r[itemNameCol]), tokens)
        ).slice(0, 30);

        for (const r of andResults) {
          const itemNo = String((r as any)[itemNoCol]);
          const itemName = String((r as any)[itemNameCol]);
          if (!results.has(itemNo)) {
            results.set(itemNo, { item_no: itemNo, item_name: itemName, priority: 3 });
          }
        }

        console.log(`[MultiToken] AND 검색: "${tokens.join('" AND "')}" → ${andResults.length}개`);
      } catch (e) {
        console.error('[MultiToken] AND 검색 실패:', e);
      }
    }

    // 전략 2: Half 검색 (절반 이상 토큰 포함) - 중간 우선순위
    if (tokens.length >= 3) {
      try {
        const halfCount = Math.ceil(tokens.length / 2);
        const halfTokens = tokens.slice(0, halfCount);
        const halfExpanded = halfTokens.flatMap(t => getTokenWithSynonyms(t));
        const halfUnique = [...new Set(halfExpanded)];
        const halfOrFilter = halfUnique.map(t => `${itemNameCol}.ilike.%${t}%`).join(',');
        const { data } = await supabase
          .from(table)
          .select(`${itemNoCol}, ${itemNameCol}`)
          .or(halfOrFilter)
          .limit(500);
        const halfResults = (data || []).filter((r: any) =>
          matchesAllTokensWithSynonyms(String(r[itemNameCol]), halfTokens)
        ).slice(0, 40);

        for (const r of halfResults) {
          const itemNo = String((r as any)[itemNoCol]);
          const itemName = String((r as any)[itemNameCol]);
          if (!results.has(itemNo)) {
            results.set(itemNo, { item_no: itemNo, item_name: itemName, priority: 2 });
          }
        }

        console.log(`[MultiToken] Half 검색: "${halfTokens.join('" AND "')}" → ${halfResults.length}개`);
      } catch (e) {
        console.error('[MultiToken] Half 검색 실패:', e);
      }
    }

    // 전략 3: OR 검색 (하나라도 포함) - 낮은 우선순위 (동의어 확장)
    try {
      const orExpanded = tokens.flatMap(t => getTokenWithSynonyms(t));
      const orUnique = [...new Set(orExpanded)];
      const orFilter = orUnique.map(t => `${itemNameCol}.ilike.%${t}%`).join(',');
      const { data } = await supabase
        .from(table)
        .select(`${itemNoCol}, ${itemNameCol}`)
        .or(orFilter)
        .limit(50);
      const orResults = (data || []);

      for (const r of orResults) {
        const itemNo = String((r as any)[itemNoCol]);
        const itemName = String((r as any)[itemNameCol]);
        if (!results.has(itemNo)) {
          results.set(itemNo, { item_no: itemNo, item_name: itemName, priority: 1 });
        }
      }

      console.log(`[MultiToken] OR 검색: "${tokens.join('" OR "')}" → ${orResults.length}개`);
    } catch (e) {
      console.error('[MultiToken] OR 검색 실패:', e);
    }

    // 우선순위 순으로 정렬하고 limit 적용
    const sorted = Array.from(results.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map(({ item_no, item_name }) => ({ item_no, item_name }));

    console.log(`[MultiToken] 총 후보: ${sorted.length}개 (중복 제거 후)`);

    return sorted;
  } catch (e) {
    console.error('[MultiToken] 전체 검색 실패:', e);
    return [] as Array<{ item_no: string; item_name: string }>;
  }
}

/* ================= 신규 품목 검색 (English 시트) ================= */

async function searchNewItemFromMaster(query: string): Promise<Array<{ item_no: string; item_name: string; score: number; is_new_item?: boolean; supply_price?: number }>> {
  try {
    // 🔄 scoreItem과 동일한 로직으로 점수 계산
    const masterItems = searchMasterSheet(query, 20); // 더 많이 가져오기

    // 🔥 Downloads price map 미리 로드
    const downloadsPriceMap = getDownloadsPriceMap();
    console.log(`[searchNewItemFromMaster] Downloads price map loaded: ${downloadsPriceMap.size} items`);

    // scoreItem 함수로 재점수 계산
    const rescored = await Promise.all(masterItems.map(async item => {
      const koreanScore = scoreItem(query, item.koreanName);
      const englishScore = scoreItem(query, item.englishName);
      const maxScore = Math.max(koreanScore, englishScore);

      // 🔥 공급가 우선순위: 1) Downloads map, 2) master item, 3) DB
      let supplyPrice: number | undefined = downloadsPriceMap.get(item.itemNo) ?? item.supplyPrice;
      console.log(`[searchNewItemFromMaster] 🔍 ${item.itemNo}: Downloads=${downloadsPriceMap.get(item.itemNo)}, master=${item.supplyPrice}, 선택=${supplyPrice}`);

      // DB에서도 확인 (fallback)
      if (!supplyPrice) {
        try {
          const { data: itemRow } = await supabase
            .from('inventory_cdv')
            .select('supply_price')
            .eq('item_no', String(item.itemNo))
            .maybeSingle();
          if (itemRow?.supply_price) {
            supplyPrice = itemRow.supply_price;
            console.log(`[searchNewItemFromMaster] ✅ DB에서 공급가 조회: ${item.itemNo} = ${supplyPrice}원`);
          }
        } catch (e) {
          console.error(`[searchNewItemFromMaster] ❌ DB 조회 실패: ${item.itemNo}`, e);
        }
      }

      console.log(`[searchNewItemFromMaster] 🎯 최종: ${item.itemNo} = ${supplyPrice}원`);

      const resultItem = {
        item_no: item.itemNo,
        item_name: `${item.koreanName} / ${item.englishName}${item.vintage ? ` (${item.vintage})` : ''}`,
        score: maxScore,
        is_new_item: true,
        supply_price: supplyPrice,
      };

      // 🔥 반환 직전 객체 확인
      console.log(`[searchNewItemFromMaster] 📦 반환 객체:`, JSON.stringify(resultItem, null, 2));

      return resultItem;
    }));

    // 점수 순으로 정렬 후 상위 10개 반환
    return rescored
      .filter(item => (item.score ?? 0) > 0.3) // 최소 점수 필터 (undefined 방어)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) // undefined 방어
      .slice(0, 10);
  } catch (err) {
    console.error('신규 품목 검색 실패:', err);
    return [];
  }
}

/* ================= 영문명 맵 로드 ================= */

async function loadEnglishMap(): Promise<Map<string, string>> {
  try {
    const { data: rows } = await supabase
      .from('item_english')
      .select('item_no, name_en');
    const m = new Map<string, string>();
    for (const r of (rows || [])) {
      const k = String((r as any).item_no ?? "").trim();
      const v = String((r as any).name_en ?? "").trim();
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

async function getLearnedMatch(rawInput: string, clientCode?: string): Promise<LearnedMatch> {
  try {
    // Tables always exist in Supabase, no need to CREATE TABLE

    const inputItem = stripQtyAndUnit(rawInput);
    const nInputItem = normTight(inputItem);

    // ✅ 거래처별 학습 우선, 전역('*') 폴백
    let rows: AliasRow[] = [];

    if (clientCode) {
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical')
        .or(`client_code.eq.${clientCode},client_code.eq.*`);
      rows = (data || []) as AliasRow[];
    }
    if (!rows?.length) {
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical')
        .order('count', { ascending: false });
      rows = (data || []) as AliasRow[];
    }

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
  } catch {
    return null;
  }
}

/* ================= 캐시 기반 학습 매칭 (DB 조회 없음) ================= */

function getLearnedMatchCached(
  rawInput: string,
  clientCode: string | undefined,
  allAliases: PreloadedScoringData['itemAliases']
): LearnedMatch {
  const inputItem = stripQtyAndUnit(rawInput);
  const nInputItem = normTight(inputItem);

  // 1) 거래처별 + 전역 별칭 필터
  let rows = clientCode
    ? allAliases.filter(r => r.client_code === clientCode || r.client_code === '*' || !r.client_code)
    : [];

  // 2) 없으면 전체 (count 내림차순)
  if (!rows.length) {
    rows = [...allAliases].sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  if (!rows.length) return null;

  const pairs = rows
    .map(r => {
      const aliasItem = stripQtyAndUnit(r.alias);
      return {
        aliasItem,
        nAliasItem: normTight(aliasItem),
        canonical: String(r.canonical || "").trim(),
      };
    })
    .filter(x => x.nAliasItem && x.canonical)
    .sort((a, b) => b.nAliasItem.length - a.nAliasItem.length);

  for (const p of pairs) {
    if (p.nAliasItem === nInputItem) {
      return { kind: "exact", alias: p.aliasItem, canonical: p.canonical };
    }
  }

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

export async function resolveItemsByClientWeighted(
  clientCode: string,
  items: Array<{ name: string; qty: number }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
): Promise<ResolvedItem[]> {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 5;

  // 🔥 Downloads price map 미리 로드 (캐시 우회)
  console.log('[resolveItemsByClientWeighted] 🚀 Pre-loading Downloads price map...');
  const priceMap = getDownloadsPriceMap();
  console.log(`[resolveItemsByClientWeighted] ✅ Price map loaded: ${priceMap.size} items`);

  // 찰스 하이직 샘플 확인
  const charlesPrice = priceMap.get('00NV801');
  console.log(`[resolveItemsByClientWeighted] Sample check: 00NV801 = ${charlesPrice ? charlesPrice.toLocaleString() + '원' : '❌ 없음'}`);

  // ✅ 마스터 데이터는 inventory_cdv 테이블 사용 (Excel sync에서 이미 동기화됨)

  // 거래처 이력 후보
  // ✅ 신규 사업자(NEW)는 이력이 없으므로 빈 배열로 초기화
  let clientRows: Array<{ item_no: string; item_name: string }> = [];
  if (clientCode !== "NEW") {
    const { data: clientRowsData } = await supabase
      .from('client_item_stats')
      .select('item_no, item_name')
      .eq('client_code', clientCode);
    clientRows = (clientRowsData || []) as Array<{ item_no: string; item_name: string }>;
  }

  console.log(`[resolveItemsWeighted] clientCode="${clientCode}", clientRows.length=${clientRows.length}`);

  // 영문명 맵
  const englishMap = await loadEnglishMap();

  // 🚀 성능 최적화: 스코어링 데이터 일괄 프리로드 (N+1 쿼리 방지)
  const preloaded = await preloadScoringData(clientCode);
  console.log(`[resolveItemsWeighted] 🚀 프리로드 완료: aliases=${preloaded.itemAliases.length}, stats=${preloaded.clientStats.size}, tokens=${preloaded.tokenMappings.length}, prices=${preloaded.supplyPrices.size}`);

  // items.map() → sequential for loop (async operations inside)
  const resolvedItems: ResolvedItem[] = [];

  for (const it of items) {
    try {
    // ✨ 1단계: 자연어 전처리 (별칭 확장, 수량/와인용어 정규화)
    // ⚠️ LLM 사전 확장된 품목은 전처리 건너뛰기 (역방향 매핑으로 원래 약어로 되돌아가는 버그 방지)
    let searchName: string;
    if ((it as any)._llmExpanded || (it as any)._originalName) {
      // LLM/사전 확장된 품목: expandAliases 스킵 (역방향 매핑 오염 방지)
      // normalizeProducers만 적용 (at→알테시노, bs→비온디산티 등 브랜드코드 변환)
      searchName = normalizeProducers(it.name);
      console.log(`[resolveItemsWeighted] 입력: "${it.name}" → 생산자정규화: "${searchName}" (확장됨, expandAliases 스킵)`);
    } else {
      const preprocessed = await preprocessNaturalLanguage(it.name);
      searchName = preprocessed !== it.name ? preprocessed : it.name;
      console.log(`[resolveItemsWeighted] 입력: "${it.name}" → 전처리: "${searchName}"`);
    }

    // 🔍 0단계: 품목번호 정확 매칭 (최우선)
    // 예: "0884/33", "D701049" 같은 품목번호 직접 입력 케이스
    const itemNoPattern = /^([A-Z]?\d{4,7}[\/-]?\d{0,3})$/i;
    const itemNoMatch = stripQtyAndUnit(searchName).trim().match(itemNoPattern);

    if (itemNoMatch) {
      const inputItemNo = itemNoMatch[1].toUpperCase();
      console.log(`[ItemNo Exact] 품목번호 입력 감지: "${inputItemNo}"`);

      // 🍷 와인잔 특별 처리: 품목명 내부의 번호 매칭 (예: "RD 0884/33 ...")
      // 와인잔은 품목명에 "RD 0884/33" 같은 패턴이 포함됨
      try {
        console.log(`[Glass Pattern] 와인잔 패턴 검색: "%RD ${inputItemNo}%"`);

        // 1-1) 거래처 이력에서 품목명 내부 번호로 검색
        const { data: clientGlassRows } = await supabase
          .from('client_item_stats')
          .select('item_no, item_name')
          .eq('client_code', clientCode)
          .or(`item_name.ilike.%RD ${inputItemNo}%,item_name.ilike.%RD ${inputItemNo.replace(/\//g, '-')}%,item_name.ilike.%RD ${inputItemNo.replace(/[\/-]/g, '')}%`)
          .limit(1);
        const clientGlass = clientGlassRows?.[0] as any;

        if (clientGlass) {
          console.log(`[Glass Pattern] ✅ 거래처 이력에서 와인잔 발견: ${clientGlass.item_no} - ${clientGlass.item_name}`);
          resolvedItems.push({
            ...it,
            normalized_query: searchName,
            resolved: true,
            item_no: clientGlass.item_no,
            item_name: clientGlass.item_name,
            score: 1.0,
            method: "glass_pattern_client",
            candidates: [],
            suggestions: [],
          });
          continue;
        }

        // 1-2) 마스터 테이블(items)에서 품목명 내부 번호로 검색
        const { data: masterGlassRows } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name')
          .or(`item_name.ilike.%RD ${inputItemNo}%,item_name.ilike.%RD ${inputItemNo.replace(/\//g, '-')}%,item_name.ilike.%RD ${inputItemNo.replace(/[\/-]/g, '')}%`)
          .limit(1);
        const masterGlass = masterGlassRows?.[0] as any;

        if (masterGlass) {
          console.log(`[Glass Pattern] ✅ 마스터에서 와인잔 발견: ${masterGlass.item_no} - ${masterGlass.item_name}`);

          const supplyPrice = masterGlass.supply_price || masterGlass.price;

          resolvedItems.push({
            ...it,
            normalized_query: searchName,
            resolved: false,
            method: "glass_pattern_master",
            candidates: [],
            suggestions: [{
              item_no: masterGlass.item_no,
              item_name: masterGlass.item_name,
              score: 1.0,
              is_new_item: true,
              supply_price: supplyPrice,
            } as any],
          });
          continue;
        }
      } catch (e) {
        console.error('[Glass Pattern] 와인잔 패턴 검색 실패:', e);
      }

      // 1) 거래처 이력에서 먼저 검색 (품목 코드 직접 매칭)
      const { data: clientExactRows } = await supabase
        .from('client_item_stats')
        .select('item_no, item_name')
        .eq('client_code', clientCode)
        .or(`item_no.eq.${inputItemNo},item_no.eq.${inputItemNo.replace(/\//g, '')},item_no.eq.${inputItemNo.replace(/-/g, '')}`)
        .limit(1);
      const clientExact = clientExactRows?.[0] as any;

      if (clientExact) {
        console.log(`[ItemNo Exact] ✅ 거래처 이력에서 발견: ${clientExact.item_no} - ${clientExact.item_name}`);
        resolvedItems.push({
          ...it,
          normalized_query: searchName,
          resolved: true,
          item_no: clientExact.item_no,
          item_name: clientExact.item_name,
          score: 1.0,
          method: "item_no_exact_client",
          candidates: [],
          suggestions: [],
        });
        continue;
      }

      // 2) 마스터 테이블(items)에서 검색
      try {
        const { data: masterExactRows } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name, supply_price')
          .or(`item_no.eq.${inputItemNo},item_no.eq.${inputItemNo.replace(/\//g, '')},item_no.eq.${inputItemNo.replace(/-/g, '')}`)
          .limit(1);
        const masterExact = masterExactRows?.[0] as any;

        if (masterExact) {
          console.log(`[ItemNo Exact] ✅ 마스터에서 발견: ${masterExact.item_no} - ${masterExact.item_name}`);

          // 신규 품목으로 표시
          const supplyPrice = masterExact.supply_price || masterExact.price;

          resolvedItems.push({
            ...it,
            normalized_query: searchName,
            resolved: false, // 신규 품목은 미확정
            method: "item_no_exact_master",
            candidates: [],
            suggestions: [{
              item_no: masterExact.item_no,
              item_name: masterExact.item_name,
              score: 1.0,
              is_new_item: true,
              supply_price: supplyPrice,
            } as any],
          });
          continue;
        }
      } catch (e) {
        console.error('[ItemNo Exact] 마스터 검색 실패:', e);
      }

      // 3) 신규 품목(master_items)에서 검색
      try {
        const { data: newItemRows } = await supabase
          .from('master_items')
          .select('item_no, item_name, supply_price')
          .or(`item_no.eq.${inputItemNo},item_no.eq.${inputItemNo.replace(/\//g, '')},item_no.eq.${inputItemNo.replace(/-/g, '')}`)
          .limit(1);
        const newItemExact = newItemRows?.[0] as any;

        if (newItemExact) {
          console.log(`[ItemNo Exact] ✅ 신규 품목에서 발견: ${newItemExact.item_no} - ${newItemExact.item_name}`);
          resolvedItems.push({
            ...it,
            normalized_query: searchName,
            resolved: false,
            method: "item_no_exact_new",
            candidates: [],
            suggestions: [{
              item_no: newItemExact.item_no,
              item_name: newItemExact.item_name,
              score: 1.0,
              is_new_item: true,
              supply_price: newItemExact.supply_price,
            } as any],
          });
          continue;
        }
      } catch (e) {
        console.error('[ItemNo Exact] 신규 품목 검색 실패:', e);
      }

      console.log(`[ItemNo Exact] ❌ 품목번호를 찾을 수 없음: ${inputItemNo}`);
    }

    // ✨ 2단계: 검색어 확장 (토큰 매핑 학습 활용)
    const expansion = await expandQuery(searchName, 0.5);
    logQueryExpansion(expansion);

    // 🏭 생산자 감지 (브랜드가 명시된 경우 해당 브랜드만 검색)
    const { hasProducer, producer } = await detectProducer(searchName);

    if (hasProducer) {
      console.log(`[Wine] 생산자 감지됨: "${producer}" - 해당 브랜드 품목만 필터링`);
    }

    // ✅ 학습 매칭은 원본 이름(it.name)으로 먼저, 전처리된 이름으로 폴백 (캐시 기반)
    const learned = getLearnedMatchCached(it.name, clientCode, preloaded.itemAliases) || getLearnedMatchCached(searchName, clientCode, preloaded.itemAliases);
    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // 마스터 후보 (전처리된 검색어 + 확장된 검색어)
    const masterRows1 = await fetchFromMasterByTail(searchName, 40);
    const masterRows2 = expansion.hasExpansion
      ? await fetchFromMasterByTail(expansion.expanded, 40)
      : [];

    // ✅ 영문명으로도 검색 (English 시트 활용)
    const englishRows: Array<{ item_no: string; item_name: string; supply_price?: number }> = [];
    const hasEnglish = /[A-Za-z]{3,}/.test(searchName);
    if (hasEnglish) {
      try {
        console.log(`[English Sheet] 영어 검색 시도: "${searchName}"`);
        const englishMatches = await findMultipleFromEnglish(searchName, 10);

        for (const match of englishMatches) {
          // 거래처 이력에 있는 한글명 사용 (프리로드 데이터 활용 - DB 조회 없음)
          const clientHit = clientRows.find(cr => String(cr.item_no) === match.code);
          const clientStat = preloaded.clientStats.get(match.code);

          const displayName = clientHit?.item_name || match.koreanName || match.englishName;
          const supplyPrice = clientStat?.supply_price || match.supplyPrice || preloaded.supplyPrices.get(match.code);

          englishRows.push({
            item_no: match.code,
            item_name: displayName,
            supply_price: supplyPrice
          });
        }

        if (englishRows.length > 0) {
          console.log(`[English Sheet] ✅ ${englishRows.length}개 매칭됨`);
          englishRows.forEach((r, idx) => {
            console.log(`  ${idx+1}. [${r.item_no}] ${r.item_name} (공급가: ${r.supply_price?.toLocaleString() || 'N/A'}원)`);
          });
        }
      } catch (e) {
        console.error('[English Sheet] 검색 실패:', e);
      }
    }

    // 후보 풀 = 거래처이력(최우선) + 마스터(원본) + 마스터(확장) + 영문명 (중복 제거)
    // ✅ 거래처 이력을 최우선으로 추가하여 한글 품목명이 영문 약자보다 먼저 매칭되도록 함
    // 예: 3021049 "클레멍 라발리, 샤블리" (거래처 이력) > 3022049 "CL 샤블리" (마스터)
    const poolMap = new Map<string, { item_no: string; item_name: string; supply_price?: number }>();

    // 1순위: 거래처 이력 (한글 품목명 우선)
    for (const r of clientRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }

    // 2순위: 마스터 품목 (거래처 이력에 없는 것만 추가)
    for (const r of masterRows1) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
      }
    }
    for (const r of masterRows2) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
      }
    }

    // 3순위: 영문명 (거래처 이력에 없는 것만 추가, 공급가 포함)
    for (const r of englishRows) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), {
          item_no: String(r.item_no),
          item_name: String(r.item_name),
          supply_price: r.supply_price
        });
      }
    }

    const pool = Array.from(poolMap.values());

    console.log(`[후보풀] 거래처이력 ${clientRows.length}개 + 마스터 ${masterRows1.length + masterRows2.length}개 + 영문 ${englishRows.length}개 = 총 ${pool.length}개`);

    // 🏭 생산자 필터링: 생산자가 감지되면 해당 생산자 품목만 남기기
    let filteredPool = pool;
    if (hasProducer && producer) {
      const producerNorm = normTight(producer);
      filteredPool = pool.filter(r => {
        const itemNameNorm = normTight(r.item_name);
        const matches = itemNameNorm.includes(producerNorm);

        if (!matches) {
          console.log(`[Producer Filter] ❌ 제외: "${r.item_name}" (생산자 불일치)`);
        }

        return matches;
      });

      console.log(`[Producer Filter] 생산자 "${producer}" 필터 적용: ${pool.length}개 → ${filteredPool.length}개`);

      // 필터링 후 후보가 너무 적으면 경고
      if (filteredPool.length === 0) {
        console.warn(`[Producer Filter] ⚠️ 생산자 필터링 후 후보가 0개! 필터 무시하고 전체 검색`);
        filteredPool = pool; // 롤백
      } else if (filteredPool.length < 3) {
        console.warn(`[Producer Filter] ⚠️ 생산자 필터링 후 후보가 ${filteredPool.length}개만 남음`);
      }
    }

    // 1) Exact 학습이면 하드 확정
    if (learned && learned.kind === "exact" && learnedItemNo) {
      let hit = filteredPool.find((r) => String(r.item_no) === learnedItemNo);
      // ✅ 풀에 없으면 DB에서 직접 조회 (학습된 약어 → 품목번호 매핑)
      if (!hit) {
        const { data: dbRow } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name')
          .eq('item_no', learnedItemNo)
          .limit(1)
          .maybeSingle();
        if (dbRow) hit = { item_no: String(dbRow.item_no), item_name: String(dbRow.item_name) };
      }
      if (hit) {
        console.log(`[Learn] ✅ alias_exact 매칭: "${searchName}" → ${hit.item_no} ${hit.item_name}`);
        resolvedItems.push({
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(searchName)),
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
      let hit = filteredPool.find((r) => String(r.item_no) === learnedItemNo);
      // ✅ 풀에 없으면 DB에서 직접 조회
      if (!hit) {
        const { data: dbRow } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name')
          .eq('item_no', learnedItemNo)
          .limit(1)
          .maybeSingle();
        if (dbRow) hit = { item_no: String(dbRow.item_no), item_name: String(dbRow.item_name) };
      }
      if (hit) {
        console.log(`[Learn] ✅ alias_contains_specific 매칭: "${searchName}" → ${hit.item_no} ${hit.item_name}`);
        resolvedItems.push({
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(searchName)),
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
    // ⚠️ LLM 확장된 품목은 이미 정확한 이름이므로 synonym 재적용 스킵
    // (이중 확장 방지: "카베르네 소비뇽" → "카베르네 소비뇽 블랑 소비뇽 블랑")
    const synonymApplied = ((it as any)._llmExpanded || (it as any)._originalName)
      ? searchName
      : applyItemSynonym(searchName);
    const q = normalizeItemName(synonymApplied);
    const qExpanded = expansion.hasExpansion ? normalizeItemName(expansion.expanded) : q;

    // Sequential scoring loop (calculateWeightedScore is async)
    const scoredRaw: Array<{
      item_no: string;
      item_name: string;
      score: number;
      is_new_item?: boolean;
      supply_price?: number;
      _debug?: any;
    }> = [];

    for (const r of filteredPool) {
      // 생산자 옵션은 이미 필터링했으므로 불필요 (하지만 점수 계산에는 유지)
      const scoreOptions = hasProducer ? { producer } : undefined;

      // 원본 쿼리 점수
      const ko1 = scoreItem(q, r.item_name, scoreOptions);

      // 확장된 쿼리 점수 (학습 효과)
      const ko2 = expansion.hasExpansion ? scoreItem(qExpanded, r.item_name, scoreOptions) : 0;

      // 영문명 점수 (정규화 전 원본 searchName 사용)
      const enName = englishMap.get(String(r.item_no)) || "";
      const en1 = enName ? scoreItem(q, enName, scoreOptions) : 0;
      const en2 = enName ? scoreItem(searchName.toLowerCase(), enName, scoreOptions) : 0;
      const en = Math.max(en1, en2);

      // 최고 점수 선택 (확장 검색은 20% 부스트)
      const baseScore = Math.max(ko1, ko2 * 1.2, en);

      // 🎯 가중치 시스템으로 최종 점수 계산 (캐시 기반 - DB 조회 제로)
      const weighted = calculateWeightedScoreCached(
        it.name,
        clientCode,
        String(r.item_no),
        baseScore,
        preloaded,
        undefined, // dataType (기본값 'wine' 사용)
        (r as any).supply_price // ✅ 신규 품목인 경우에만 있음
      );

      // ✅ baseScore가 매우 높으면 (0.80+) 가중치를 덜 받도록 조정
      // 이유: "아이니 샤도네이" 검색 시 "CK 샤도네이"가 "PS 루씨아"보다 우선되어야 함
      let finalScore = weighted.finalScore;
      if (baseScore >= 0.80 && weighted.finalScore < baseScore) {
        // baseScore가 높은데 가중치로 인해 낮아진 경우, baseScore를 더 중시
        finalScore = baseScore * 0.7 + weighted.finalScore * 0.3;
        console.log(`[resolveItemsWeighted] High baseScore boost: ${r.item_no} ${r.item_name.substring(0, 30)} - base:${baseScore.toFixed(3)} → weighted:${weighted.finalScore.toFixed(3)} → final:${finalScore.toFixed(3)}`);
      }

      // ✅ 거래처 이력에 있는지 확인 (is_new_item 플래그 설정)
      const isInClientHistory = clientRows.some(cr => String(cr.item_no) === String(r.item_no));

      // ✅ supply_price 조회 (프리로드 맵에서 - DB 조회 없음)
      const supplyPrice: number | undefined = (r as any).supply_price
        || preloaded.supplyPrices.get(String(r.item_no))
        || undefined;

      scoredRaw.push({
        item_no: r.item_no,
        item_name: r.item_name,
        score: finalScore,
        is_new_item: !isInClientHistory, // 거래처 이력에 없으면 신규
        supply_price: supplyPrice,
        _debug: {
          baseScore: weighted.signals.baseScore,
          userLearning: weighted.signals.userLearning,
          recentPurchase: weighted.signals.recentPurchase,
          purchaseFrequency: weighted.signals.purchaseFrequency,
          vintage: weighted.signals.vintage,
          weights: weighted.weights,
          rawTotal: weighted.rawTotal,
          isInClientHistory,
        },
      });
    }

    const scored = scoredRaw
      .sort((a, b) => {
        // 1차: score 내림차순 (undefined 방어)
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        // 2차: baseScore 내림차순 (같은 최종 점수일 때 baseScore가 높은 것 우선)
        const aBase = a._debug?.baseScore ?? 0;
        const bBase = b._debug?.baseScore ?? 0;
        if (bBase !== aBase) return bBase - aBase;

        // 3차: 거래처 이력 우선 (같은 점수일 때 기존 거래처 품목 우선)
        const aInHistory = a._debug?.isInClientHistory ?? false;
        const bInHistory = b._debug?.isInClientHistory ?? false;
        if (aInHistory !== bInHistory) return aInHistory ? -1 : 1;

        // 4차: item_no 오름차순 (안정적인 정렬)
        return String(a.item_no).localeCompare(String(b.item_no));
      })
      // 🔍 공급가가 없는 품목 필터링
      .filter((item) => {
        if (item.supply_price && item.supply_price > 0) {
          return true;
        }
        console.log(`[Filter] ❌ 공급가 없음으로 제외 (scored): [${item.item_no}] ${item.item_name}`);
        return false;
      });

    console.log(`[Filter] scored 필터링 완료: 공급가 있는 품목만 ${scored.length}개`);

    const top = scored[0];
    const second = scored[1];

    // ✅ 중앙 설정에서 임계값 가져오기
    const config = ITEM_MATCH_CONFIG.autoResolve;

    // 자동확정 조건
    // ⚠️ 신규 사업자(NEW)는 절대 자동 확정하지 않음 (항상 수동 선택)
    // ⚠️ 신규 품목(is_new_item)은 절대 자동 확정하지 않음 (항상 수동 선택)
    let resolved =
      clientCode !== "NEW" &&
      !!top &&
      top.is_new_item !== true &&  // 🔴 신규 품목은 자동 확정 금지
      (top.score ?? 0) >= minScore &&
      (!second || (top.score ?? 0) - (second.score ?? 0) >= minGap);

    // 🏭 생산자가 명시된 경우 더 엄격한 조건 적용
    if (hasProducer && resolved) {
      const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;
      // 생산자 명시 시: 점수 0.85 이상, gap 0.25 이상 필요
      const allowAuto = (top.score ?? 0) >= 0.85 && gap >= 0.25;
      if (!allowAuto) {
        resolved = false;
        console.log(`[Wine] 생산자 명시 → 자동 확정 조건 강화:`, {
          producer: producer,
          score: (top.score ?? 0),
          gap: gap,
          allowAuto: allowAuto
        });
      }
    }

    // ✅ 토큰 3개 이상인 경우: 고신뢰도 점수 요구 (완화된 조건)
    const tokenCount = stripQtyAndUnit(it.name).split(" ").filter(Boolean).length;
    if (tokenCount >= 3) {
      const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;

      // learned가 있는 경우 (기존 로직 유지)
      if (learned?.kind === "contains_weak") {
        const allowAuto = ((top.score ?? 0) >= config.highConfidenceScore && gap >= config.highConfidenceGap) ||
                          ((top.score ?? 0) >= 0.88 && gap >= 0.20);  // ✅ 0.30 → 0.20 완화
        if (!allowAuto) {
          resolved = false;
        }
      }
      // learned가 없는 경우: 완화된 조건 (0.70 이상 + gap 0.15 이상)
      else if (!learned) {
        const allowAuto = ((top.score ?? 0) >= config.highConfidenceScore && gap >= config.highConfidenceGap) ||
                          ((top.score ?? 0) >= 0.70 && gap >= 0.15);  // ✅ minScore 0.70, minGap 0.30 → 0.15 완화
        if (!allowAuto) {
          resolved = false;
        }
      }
    }

    if (resolved) {
      resolvedItems.push({
        ...it,
        normalized_query: q,
        resolved: true,
        item_no: top.item_no,
        item_name: top.item_name,
        score: Number((top.score ?? 0).toFixed(3)),
        method: learned?.kind ? `weighted+${learned.kind}` : "weighted",
        candidates: (() => {
          // ✅ 중복 제거 (item_no 기준)
          const candidateMap = new Map<string, any>();
          for (const c of scored.slice(0, topN * 2)) {
            const existing = candidateMap.get(c.item_no);
            if (!existing || c.score > existing.score) {
              candidateMap.set(c.item_no, {
                item_no: c.item_no,
                item_name: c.item_name,
                score: Number((c.score ?? 0).toFixed(3)),
                is_new_item: c.is_new_item,
                supply_price: c.supply_price,
                _debug: c._debug,
              });
            }
          }

          // 🔍 공급가가 없는 품목 필터링
          const filteredCandidates = Array.from(candidateMap.values()).filter(item => {
            if (item.supply_price && item.supply_price > 0) {
              return true;
            }
            console.log(`[Filter] ❌ 공급가 없음으로 제외 (candidates): [${item.item_no}] ${item.item_name}`);
            return false;
          });

          console.log(`[Filter] candidates 필터링: ${Array.from(candidateMap.values()).length}개 → ${filteredCandidates.length}개`);

          return filteredCandidates
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) // undefined 방어
            .slice(0, topN);
        })(),
        suggestions: (() => {
          // ✅ suggestions도 중복 제거
          const suggestionMap = new Map<string, any>();
          for (const c of scored.slice(0, Math.max(10, topN) * 2)) {
            const existing = suggestionMap.get(c.item_no);
            if (!existing || c.score > existing.score) {
              suggestionMap.set(c.item_no, {
                item_no: c.item_no,
                item_name: c.item_name,
                score: Number((c.score ?? 0).toFixed(3)),
                is_new_item: c.is_new_item,
                supply_price: c.supply_price,
              });
            }
          }

          // 🔍 공급가가 없는 품목 필터링
          const filteredSuggestions = Array.from(suggestionMap.values()).filter(item => {
            if (item.supply_price && item.supply_price > 0) {
              return true;
            }
            console.log(`[Filter] ❌ 공급가 없음으로 제외: [${item.item_no}] ${item.item_name}`);
            return false;
          });

          console.log(`[Filter] suggestions 필터링: ${Array.from(suggestionMap.values()).length}개 → ${filteredSuggestions.length}개`);

          return filteredSuggestions
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) // undefined 방어
            .slice(0, Math.max(10, topN));
        })(),
      });
      continue;
    }

    // ✅ 신규 품목 검색: 항상 실행 (더 정확한 매칭을 찾기 위해)
    // baseScore가 높아도 신규 품목 중 더 나은 매칭이 있을 수 있음
    const topBaseScore = top?._debug?.baseScore || 0;
    const shouldSearchNew = true; // 항상 신규 품목도 함께 검색

    console.log('[Wine] 신규 품목 검색:', {
      topBaseScore,
      topFinalScore: top?.score,
      shouldSearchNew: true,
      reason: '항상 신규 품목과 기존 품목을 혼합 표시'
    });

    const suggestions = shouldSearchNew
      ? await (async () => {
          // 신규품목 검색 (English 시트)
          let newItems = await searchNewItemFromMaster(q);

          // 🏭 생산자 필터링 (생산자가 명시된 경우)
          if (hasProducer && newItems.length > 0) {
            const producerNorm = normTight(producer);
            newItems = newItems.filter(ni => {
              const nameNorm = normTight(ni.item_name);
              const match = nameNorm.includes(producerNorm);
              if (!match) {
                console.log(`[Wine] ❌ 신규 품목 생산자 불일치: "${producer}" not in "${ni.item_name}"`);
              }
              return match;
            });
            console.log(`[Wine] 생산자 필터 후 신규 품목: ${newItems.length}개`);
          }

          // 🔄 기존 품목(scored)과 신규 품목을 점수 기준으로 혼합
          const allItems = [
            // 기존 품목 상위 10개
            ...scored.slice(0, 10).map((c) => ({
              item_no: c.item_no,
              item_name: c.item_name,
              score: Number((c.score ?? 0).toFixed(3)),
              is_new_item: c.is_new_item,
              supply_price: c.supply_price,
            })),
            // 신규 품목
            ...newItems
          ];

          // 중복 제거 (item_no 기준)
          const itemMap = new Map<string, typeof allItems[0]>();
          for (const item of allItems) {
            const existing = itemMap.get(item.item_no);
            if (!existing || item.score > existing.score) {
              itemMap.set(item.item_no, item);
            }
          }

          // 🔍 공급가가 없는 품목 필터링
          const filteredItems = Array.from(itemMap.values()).filter(item => {
            // 공급가가 있으면 OK
            if (item.supply_price && item.supply_price > 0) {
              return true;
            }

            // 공급가가 없으면 제외
            console.log(`[Filter] ❌ 공급가 없음으로 제외: [${item.item_no}] ${item.item_name}`);
            return false;
          });

          console.log(`[Filter] 필터링 결과: ${Array.from(itemMap.values()).length}개 → ${filteredItems.length}개 (공급가 있는 품목만)`);

          // 점수 순으로 정렬 후 상위 10개
          const combined = filteredItems
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          console.log('[DEBUG] 기존+신규 혼합 후보 (10개 목표):', {
            hasProducer: hasProducer,
            producer: producer,
            scored: scored.length,
            newItems: newItems.length,
            combined: combined.length,
            top3: combined.slice(0, 3).map(c => ({ no: c.item_no, score: c.score, new: c.is_new_item }))
          });

          return combined;
        })()
      : (() => {
          // 🔍 공급가가 없는 품목 필터링
          const filteredScored = scored.slice(0, Math.max(10, topN))
            .filter((c) => {
              if (c.supply_price && c.supply_price > 0) {
                return true;
              }
              console.log(`[Filter] ❌ 공급가 없음으로 제외 (fallback): [${c.item_no}] ${c.item_name}`);
              return false;
            });

          console.log(`[Filter] fallback 필터링: ${scored.slice(0, Math.max(10, topN)).length}개 → ${filteredScored.length}개`);

          return filteredScored.map((c) => ({
            item_no: c.item_no,
            item_name: c.item_name,
            score: Number((c.score ?? 0).toFixed(3)),
            is_new_item: c.is_new_item,
            supply_price: c.supply_price,
          }));
        })();

    resolvedItems.push({
      ...it,
      normalized_query: q,
      resolved: false,
      candidates: (() => {
        // ✅ 중복 제거 (item_no 기준으로 최고 점수만 유지)
        const candidateMap = new Map<string, any>();
        for (const c of scored.slice(0, topN * 2)) { // 여유있게 2배 검색
          const existing = candidateMap.get(c.item_no);
          if (!existing || c.score > existing.score) {
            candidateMap.set(c.item_no, {
              item_no: c.item_no,
              item_name: c.item_name,
              score: Number((c.score ?? 0).toFixed(3)),
              is_new_item: c.is_new_item,
              supply_price: c.supply_price,
              _debug: c._debug,
            });
          }
        }
        return Array.from(candidateMap.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, topN);
      })(),
      suggestions,
    });
    } catch (err: any) {
      console.error(`[resolveItemsWeighted] ERROR for item "${it.name}":`, err);
      console.error(`[resolveItemsWeighted] Stack:`, err.stack);
      throw err; // Re-throw to see full stack
    }
  }

  return resolvedItems;
}
