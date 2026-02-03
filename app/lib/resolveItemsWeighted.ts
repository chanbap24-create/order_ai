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

import { db } from "@/app/lib/db";
import { applyItemSynonym } from "@/app/lib/itemsynonyms";
import { calculateWeightedScore } from "@/app/lib/weightedScoring";
import { searchMasterSheet } from "@/app/lib/masterMatcher";
import { ITEM_MATCH_CONFIG } from "@/app/lib/itemMatchConfig";
import { expandQuery, logQueryExpansion, generateQueryVariations } from "@/app/lib/queryExpander";
import { preprocessNaturalLanguage } from "@/app/lib/naturalLanguagePreprocessor";
import { loadAllMasterItems } from "@/app/lib/masterSheet";
import { multiLevelTokenMatch } from "@/app/lib/multiLevelTokenMatcher";

/* ================= 정규화 함수 ================= */

function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    // ✅ 곡선 따옴표 통일
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
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
function loadProducersFromDB(): string[] {
  try {
    // item_alias에서 생산자로 추정되는 별칭 추출
    // 3글자 이상이고, 사용 빈도 5회 이상인 것만
    const rows = db.prepare(`
      SELECT DISTINCT alias, canonical, count
      FROM item_alias
      WHERE (
        alias LIKE '%산티%' OR alias LIKE '%샤토%' OR alias LIKE '%도멘%' OR
        alias LIKE '%알테%' OR alias LIKE '%가야%' OR alias LIKE '%바롤로%' OR
        alias LIKE '%비온디%' OR alias LIKE '%메종%' OR alias LIKE '%릿지%' OR
        canonical LIKE '%산티%' OR canonical LIKE '%샤토%' OR canonical LIKE '%도멘%' OR
        canonical LIKE '%알테%' OR canonical LIKE '%가야%' OR canonical LIKE '%바롤로%' OR
        canonical LIKE '%비온디%' OR canonical LIKE '%메종%' OR canonical LIKE '%릿지%'
      )
      AND LENGTH(alias) >= 3
      AND count >= 5
      ORDER BY count DESC
      LIMIT 100
    `).all() as Array<{ alias: string; canonical: string; count: number }>;
    
    const producers = new Set<string>();
    
    rows.forEach(row => {
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
function getAllProducers(): string[] {
  if (producerCache) {
    return producerCache;
  }
  
  // DB에서 동적 로드 + 정적 리스트 합치기
  const dbProducers = loadProducersFromDB();
  const allProducers = [...WINE_PRODUCERS, ...dbProducers];
  
  // 중복 제거
  producerCache = Array.from(new Set(allProducers.map(p => p.toLowerCase())));
  
  console.log(`[Producer] 전체 생산자 목록: ${producerCache.length}개`);
  return producerCache;
}

function detectProducer(rawName: string): { hasProducer: boolean; producer: string } {
  const lowerName = rawName.toLowerCase().trim();
  const producers = getAllProducers(); // 통합 생산자 목록 사용
  
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
      const charScore = Math.min(0.89, common / Math.max(6, a.length));
      bestScore = Math.max(bestScore, charScore);
    }
  }
  
  return bestScore;
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
function fetchFromMasterByTail(rawName: string, limit = 80) {
  const table = pickMasterTable();
  if (!table) return [] as Array<{ item_no: string; item_name: string }>;

  const cols = detectColumns(table);
  if (!cols) return [] as Array<{ item_no: string; item_name: string }>;

  const tokens = getAllTokens(rawName);
  if (tokens.length === 0) return [] as Array<{ item_no: string; item_name: string }>;

  try {
    const results = new Map<string, { item_no: string; item_name: string; priority: number }>();
    
    // 전략 1: AND 검색 (모든 토큰 포함) - 최고 우선순위
    if (tokens.length >= 2) {
      try {
        const andWhere = tokens.map(() => `${cols.itemName} LIKE ?`).join(" AND ");
        const andParams = tokens.map((t) => `%${t}%`);
        const andSql = `
          SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
          FROM ${table}
          WHERE ${andWhere}
          LIMIT 30
        `;
        const andResults = db.prepare(andSql).all(...andParams) as Array<{ item_no: string; item_name: string }>;
        
        for (const r of andResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 3 });
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
        const halfWhere = halfTokens.map(() => `${cols.itemName} LIKE ?`).join(" AND ");
        const halfParams = halfTokens.map((t) => `%${t}%`);
        const halfSql = `
          SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
          FROM ${table}
          WHERE ${halfWhere}
          LIMIT 40
        `;
        const halfResults = db.prepare(halfSql).all(...halfParams) as Array<{ item_no: string; item_name: string }>;
        
        for (const r of halfResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 2 });
          }
        }
        
        console.log(`[MultiToken] Half 검색: "${halfTokens.join('" AND "')}" → ${halfResults.length}개`);
      } catch (e) {
        console.error('[MultiToken] Half 검색 실패:', e);
      }
    }
    
    // 전략 3: OR 검색 (하나라도 포함) - 낮은 우선순위
    try {
      const orWhere = tokens.map(() => `${cols.itemName} LIKE ?`).join(" OR ");
      const orParams = tokens.map((t) => `%${t}%`);
      const orSql = `
        SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
        FROM ${table}
        WHERE ${orWhere}
        LIMIT 30
      `;
      const orResults = db.prepare(orSql).all(...orParams) as Array<{ item_no: string; item_name: string }>;
      
      for (const r of orResults) {
        if (!results.has(r.item_no)) {
          results.set(r.item_no, { ...r, priority: 1 });
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

function searchNewItemFromMaster(query: string): Array<{ item_no: string; item_name: string; score: number; is_new_item?: boolean; supply_price?: number }> {
  try {
    // 🔄 scoreItem과 동일한 로직으로 점수 계산
    const masterItems = searchMasterSheet(query, 20); // 더 많이 가져오기
    
    // scoreItem 함수로 재점수 계산
    const rescored = masterItems.map(item => {
      const koreanScore = scoreItem(query, item.koreanName);
      const englishScore = scoreItem(query, item.englishName);
      const maxScore = Math.max(koreanScore, englishScore);
      
      return {
        item_no: item.itemNo,
        item_name: `${item.koreanName} / ${item.englishName}${item.vintage ? ` (${item.vintage})` : ''}`,
        score: maxScore,
        is_new_item: true,
        supply_price: item.supplyPrice,
      };
    });
    
    // 점수 순으로 정렬 후 상위 10개 반환
    return rescored
      .filter(item => item.score > 0.3) // 최소 점수 필터
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch (err) {
    console.error('신규 품목 검색 실패:', err);
    return [];
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

function getLearnedMatch(rawInput: string, clientCode?: string): LearnedMatch {
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

  // ✅ client_code 고려하여 우선순위 조회
  const rows = clientCode
    ? (db.prepare(`
        SELECT alias, canonical, client_code
        FROM item_alias
        ORDER BY
          CASE
            WHEN client_code = ? THEN 1
            WHEN client_code = '*' THEN 2
            ELSE 3
          END,
          count DESC
      `).all(clientCode) as Array<AliasRow & { client_code: string }>)
    : (db.prepare(`SELECT alias, canonical FROM item_alias`).all() as AliasRow[]);
  
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

  // ✅ 마스터 데이터 DB 동기화 (최초 1회)
  try {
    // 테이블 생성 (없으면)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS items (
        item_no TEXT PRIMARY KEY,
        item_name TEXT NOT NULL,
        supply_price REAL,
        category TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // ✅ 기존 테이블에 supply_price 컬럼이 없으면 추가 (마이그레이션)
    try {
      db.prepare(`ALTER TABLE items ADD COLUMN supply_price REAL`).run();
      console.log('[resolveItemsWeighted] Added supply_price column to items table');
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        console.warn('[resolveItemsWeighted] Failed to add supply_price column:', e.message);
      }
    }
    
    try {
      db.prepare(`ALTER TABLE items ADD COLUMN category TEXT`).run();
    } catch (e: any) {
      // 이미 있으면 무시
    }
    
    try {
      db.prepare(`ALTER TABLE items ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`).run();
    } catch (e: any) {
      // 이미 있으면 무시
    }

    // 데이터가 있는지 확인
    const count = db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number };
    
    if (count.cnt === 0) {
      // 데이터가 없으면 로드
      const allItems = loadAllMasterItems();
      const insertStmt = db.prepare('INSERT OR REPLACE INTO items (item_no, item_name, supply_price, category) VALUES (?, ?, ?, ?)');
      const insertMany = db.transaction((items: Array<{itemNo: string, koreanName: string, supplyPrice?: number}>) => {
        for (const item of items) {
          insertStmt.run(item.itemNo, item.koreanName, item.supplyPrice || null, 'wine');
        }
      });
      insertMany(allItems);
      console.log(`[resolveItemsWeighted] Master items synced: ${allItems.length} items with supply_price`);
    } else {
      // ✅ 데이터가 있지만 supply_price가 null인 경우 백필
      const nullCount = db.prepare('SELECT COUNT(*) as cnt FROM items WHERE supply_price IS NULL').get() as { cnt: number };
      
      if (nullCount.cnt > 0) {
        console.log(`[resolveItemsWeighted] Backfilling supply_price for ${nullCount.cnt} items`);
        const allItems = loadAllMasterItems();
        const updateStmt = db.prepare('UPDATE items SET supply_price = ?, updated_at = CURRENT_TIMESTAMP WHERE item_no = ? AND supply_price IS NULL');
        const updateMany = db.transaction((items: Array<{itemNo: string, supplyPrice?: number}>) => {
          for (const item of items) {
            if (item.supplyPrice) {
              updateStmt.run(item.supplyPrice, item.itemNo);
            }
          }
        });
        updateMany(allItems);
        console.log(`[resolveItemsWeighted] Supply price backfill completed`);
      }
    }
  } catch (e) {
    console.error('[resolveItemsWeighted] Failed to sync master items:', e);
  }

  // 거래처 이력 후보
  // ✅ 신규 사업자(NEW)는 이력이 없으므로 빈 배열로 초기화
  const clientRows = clientCode === "NEW" 
    ? [] 
    : db
        .prepare(
          `SELECT item_no, item_name
           FROM client_item_stats
           WHERE client_code = ?`
        )
        .all(clientCode) as Array<{ item_no: string; item_name: string }>;
  
  console.log(`[resolveItemsWeighted] clientCode="${clientCode}", clientRows.length=${clientRows.length}`);

  // 영문명 맵
  const englishMap = loadEnglishMap();

  return items.map((it) => {
    try {
    // ✨ 1단계: 자연어 전처리 (별칭 확장, 수량/와인용어 정규화)
    const preprocessed = preprocessNaturalLanguage(it.name);
    const searchName = preprocessed !== it.name ? preprocessed : it.name;
    
    console.log(`[resolveItemsWeighted] 입력: "${it.name}" → 전처리: "${searchName}"`);
    
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
        // 공백 포함해서 패턴 생성 (RD 다음에 공백)
        const glassPattern = `%RD ${inputItemNo}%`;
        const glassPattern2 = `%RD ${inputItemNo.replace(/\//g, '-')}%`;
        const glassPattern3 = `%RD ${inputItemNo.replace(/[\/-]/g, '')}%`;
        
        console.log(`[Glass Pattern] 와인잔 패턴 검색: "${glassPattern}"`);
        
        // 1-1) 거래처 이력에서 품목명 내부 번호로 검색
        const clientGlass = db.prepare(`
          SELECT item_no, item_name
          FROM client_item_stats
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
            normalized_query: searchName,
            resolved: true,
            item_no: clientGlass.item_no,
            item_name: clientGlass.item_name,
            score: 1.0,
            method: "glass_pattern_client",
            candidates: [],
            suggestions: [],
          };
        }
        
        // 1-2) 마스터 테이블에서 품목명 내부 번호로 검색
        const masterTable = pickMasterTable();
        if (masterTable) {
          const cols = detectColumns(masterTable);
          if (cols) {
            const masterGlass = db.prepare(`
              SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
              FROM ${masterTable}
              WHERE UPPER(${cols.itemName}) LIKE UPPER(?) OR
                    UPPER(${cols.itemName}) LIKE UPPER(?) OR
                    UPPER(${cols.itemName}) LIKE UPPER(?)
              LIMIT 1
            `).get(glassPattern, glassPattern2, glassPattern3) as any;
            
            if (masterGlass) {
              console.log(`[Glass Pattern] ✅ 마스터에서 와인잔 발견: ${masterGlass.item_no} - ${masterGlass.item_name}`);
              
              const supplyPrice = (masterGlass as any).supply_price || (masterGlass as any).price;
              
              return {
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
                }],
              };
            }
          }
        }
      } catch (e) {
        console.error('[Glass Pattern] 와인잔 패턴 검색 실패:', e);
      }
      
      // 1) 거래처 이력에서 먼저 검색 (품목 코드 직접 매칭)
      const clientExact = db.prepare(`
        SELECT item_no, item_name
        FROM client_item_stats
        WHERE client_code = ? AND (
          UPPER(item_no) = ? OR
          UPPER(REPLACE(item_no, '/', '')) = UPPER(REPLACE(?, '/', '')) OR
          UPPER(REPLACE(item_no, '-', '')) = UPPER(REPLACE(?, '-', ''))
        )
        LIMIT 1
      `).get(clientCode, inputItemNo, inputItemNo, inputItemNo) as any;
      
      if (clientExact) {
        console.log(`[ItemNo Exact] ✅ 거래처 이력에서 발견: ${clientExact.item_no} - ${clientExact.item_name}`);
        return {
          ...it,
          normalized_query: searchName,
          resolved: true,
          item_no: clientExact.item_no,
          item_name: clientExact.item_name,
          score: 1.0,
          method: "item_no_exact_client",
          candidates: [],
          suggestions: [],
        };
      }
      
      // 2) 마스터 테이블에서 검색
      const masterTable = pickMasterTable();
      if (masterTable) {
        const cols = detectColumns(masterTable);
        if (cols) {
          try {
            const masterExact = db.prepare(`
              SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
              FROM ${masterTable}
              WHERE UPPER(${cols.itemNo}) = ? OR
                    UPPER(REPLACE(${cols.itemNo}, '/', '')) = UPPER(REPLACE(?, '/', '')) OR
                    UPPER(REPLACE(${cols.itemNo}, '-', '')) = UPPER(REPLACE(?, '-', ''))
              LIMIT 1
            `).get(inputItemNo, inputItemNo, inputItemNo) as any;
            
            if (masterExact) {
              console.log(`[ItemNo Exact] ✅ 마스터에서 발견: ${masterExact.item_no} - ${masterExact.item_name}`);
              
              // 신규 품목으로 표시
              const supplyPrice = (masterExact as any).supply_price || (masterExact as any).price;
              
              return {
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
                }],
              };
            }
          } catch (e) {
            console.error('[ItemNo Exact] 마스터 검색 실패:', e);
          }
        }
      }
      
      // 3) 신규 품목(master_items)에서 검색
      try {
        const newItemExact = db.prepare(`
          SELECT item_no, item_name, supply_price
          FROM master_items
          WHERE UPPER(item_no) = ? OR
                UPPER(REPLACE(item_no, '/', '')) = UPPER(REPLACE(?, '/', '')) OR
                UPPER(REPLACE(item_no, '-', '')) = UPPER(REPLACE(?, '-', ''))
          LIMIT 1
        `).get(inputItemNo, inputItemNo, inputItemNo) as any;
        
        if (newItemExact) {
          console.log(`[ItemNo Exact] ✅ 신규 품목에서 발견: ${newItemExact.item_no} - ${newItemExact.item_name}`);
          return {
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
            }],
          };
        }
      } catch (e) {
        console.error('[ItemNo Exact] 신규 품목 검색 실패:', e);
      }
      
      console.log(`[ItemNo Exact] ❌ 품목번호를 찾을 수 없음: ${inputItemNo}`);
    }
    
    // ✨ 2단계: 검색어 확장 (토큰 매핑 학습 활용)
    const expansion = expandQuery(searchName, 0.5);
    logQueryExpansion(expansion);
    
    // 🏭 생산자 감지 (브랜드가 명시된 경우 해당 브랜드만 검색)
    const { hasProducer, producer } = detectProducer(searchName);
    
    if (hasProducer) {
      console.log(`[Wine] 생산자 감지됨: "${producer}" - 해당 브랜드 품목만 필터링`);
    }
    
    const learned = getLearnedMatch(searchName, clientCode);
    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // 마스터 후보 (전처리된 검색어 + 확장된 검색어)
    const masterRows1 = fetchFromMasterByTail(searchName, 40);
    const masterRows2 = expansion.hasExpansion 
      ? fetchFromMasterByTail(expansion.expanded, 40)
      : [];

    // ✅ 영문명으로도 검색 (Christophe Pitois 같은 케이스 대응)
    const englishRows: Array<{ item_no: string; item_name: string }> = [];
    const hasEnglish = /[A-Za-z]{3,}/.test(searchName);
    if (hasEnglish) {
      try {
        const words = searchName.match(/[A-Za-z]{3,}/g) || [];
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

    // 후보 풀 = 거래처이력(최우선) + 마스터(원본) + 마스터(확장) + 영문명 (중복 제거)
    // ✅ 거래처 이력을 최우선으로 추가하여 한글 품목명이 영문 약자보다 먼저 매칭되도록 함
    // 예: 3021049 "클레멍 라발리, 샤블리" (거래처 이력) > 3022049 "CL 샤블리" (마스터)
    const poolMap = new Map<string, { item_no: string; item_name: string }>();
    
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
    
    // 3순위: 영문명 (거래처 이력에 없는 것만 추가)
    for (const r of englishRows) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
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
      const hit = filteredPool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        return {
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(searchName)),
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
      const hit = filteredPool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        return {
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(searchName)),
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
    const synonymApplied = applyItemSynonym(searchName);
    const q = normalizeItemName(synonymApplied);
    const qExpanded = expansion.hasExpansion ? normalizeItemName(expansion.expanded) : q;

    const scored = filteredPool
      .map((r) => {
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

        // 🎯 가중치 시스템으로 최종 점수 계산
        // ✅ supply_price는 r 객체에 없을 수 있음 (기존 품목은 DB에 없음)
        const weighted = calculateWeightedScore(
          it.name,
          clientCode,
          String(r.item_no),
          baseScore,
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
        
        // ✅ supply_price 조회 (items 테이블에서)
        let supplyPrice: number | undefined = (r as any).supply_price;
        if (!supplyPrice) {
          try {
            const itemRow = db.prepare('SELECT supply_price FROM items WHERE item_no = ?').get(String(r.item_no)) as any;
            supplyPrice = itemRow?.supply_price || undefined;
          } catch (e) {
            // 테이블이 없거나 오류 발생 시 무시
          }
        }
        
        return {
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
        };
      })
      .sort((a, b) => {
        // 1차: score 내림차순
        if (b.score !== a.score) return b.score - a.score;
        
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
      });

    const top = scored[0];
    const second = scored[1];

    // ✅ 중앙 설정에서 임계값 가져오기
    const config = ITEM_MATCH_CONFIG.autoResolve;

    // 자동확정 조건
    // ⚠️ 신규 사업자(NEW)는 절대 자동 확정하지 않음 (항상 수동 선택)
    let resolved =
      clientCode !== "NEW" &&
      !!top && (top.score ?? 0) >= minScore && (!second || (top.score ?? 0) - (second.score ?? 0) >= minGap);

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
      return {
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
          return Array.from(candidateMap.values())
            .sort((a, b) => b.score - a.score)
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
          return Array.from(suggestionMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(10, topN));
        })(),
      };
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
      ? (() => {
          // 신규품목 검색 (English 시트)
          let newItems = searchNewItemFromMaster(q);
          
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
          
          // 점수 순으로 정렬 후 상위 10개
          const combined = Array.from(itemMap.values())
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
      : scored.slice(0, Math.max(10, topN)).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number((c.score ?? 0).toFixed(3)),
          is_new_item: c.is_new_item,
          supply_price: c.supply_price,
        }));

    return {
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
    };
    } catch (err: any) {
      console.error(`[resolveItemsWeighted] ERROR for item "${it.name}":`, err);
      console.error(`[resolveItemsWeighted] Stack:`, err.stack);
      throw err; // Re-throw to see full stack
    }
  });
}
