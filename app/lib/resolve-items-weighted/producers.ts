import { supabase } from "@/app/lib/db";

/* ================= 생산자 목록 ================= */

// order-ai.xlsx English 시트에서 자동 추출
// 마지막 업데이트: 2026-01-16
export const WINE_PRODUCERS = [
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

// 생산자 캐시 (DB에서 동적 로드용)
let producerCache: string[] | null = null;

// DB에서 생산자 목록 로드 (item_alias 테이블 활용)
async function loadProducersFromDB(): Promise<string[]> {
  try {
    const { data: rows } = await supabase
      .from('item_alias')
      .select('alias, canonical, count')
      .gte('count', 5)
      .order('count', { ascending: false })
      .limit(100);

    const filteredRows = (rows || []).filter((row: any) => {
      const alias = String(row.alias || '').toLowerCase();
      const canonical = String(row.canonical || '').toLowerCase();
      const keywords = ['산티', '샤토', '도멘', '알테', '가야', '바롤로', '비온디', '메종', '릿지'];
      return keywords.some(kw => alias.includes(kw) || canonical.includes(kw)) && alias.length >= 3;
    }) as Array<{ alias: string; canonical: string; count: number }>;

    const producers = new Set<string>();
    filteredRows.forEach(row => {
      if (row.alias.length >= 3) producers.add(row.alias.toLowerCase());
      if (row.canonical.length >= 3) producers.add(row.canonical.toLowerCase());
    });

    const result = Array.from(producers);
    console.log(`[Producer DB] 로드된 생산자 ${result.length}개:`, result.slice(0, 10));
    return result;
  } catch (e) {
    console.error('[Producer DB] 로드 실패:', e);
    return [];
  }
}

export async function getAllProducers(): Promise<string[]> {
  if (producerCache) return producerCache;

  const dbProducers = await loadProducersFromDB();
  const allProducers = [...WINE_PRODUCERS, ...dbProducers];
  producerCache = Array.from(new Set(allProducers.map(p => p.toLowerCase())));
  console.log(`[Producer] 전체 생산자 목록: ${producerCache.length}개`);
  return producerCache;
}

export async function detectProducer(rawName: string): Promise<{ hasProducer: boolean; producer: string }> {
  const lowerName = rawName.toLowerCase().trim();
  const producers = await getAllProducers();

  // 1단계: 전체 문자열에서 생산자 검색 (더 긴 매칭 우선)
  let longestMatch = '';
  let matchedProducer = '';

  for (const p of producers) {
    const pLower = p.toLowerCase();
    if (lowerName.includes(pLower)) {
      if (pLower.length > longestMatch.length) {
        longestMatch = pLower;
        const startIdx = lowerName.indexOf(pLower);
        const endIdx = startIdx + pLower.length;

        const tokens = rawName.trim().split(/\s+/);
        for (const token of tokens) {
          if (token.toLowerCase().includes(pLower)) {
            matchedProducer = token;
            break;
          }
        }
        if (!matchedProducer) matchedProducer = rawName.substring(startIdx, endIdx);
      }
    }
  }

  if (matchedProducer) {
    console.log(`[Wine] 🏭 생산자 감지: "${matchedProducer}" (패턴: "${longestMatch}", 원본: "${rawName}")`);
    return { hasProducer: true, producer: matchedProducer };
  }

  // 2단계: 첫 번째 토큰에서 생산자 검색
  const tokens = rawName.trim().split(/\s+/);
  if (tokens.length === 0) return { hasProducer: false, producer: '' };

  const firstToken = tokens[0].toLowerCase();
  const matched = producers.find(p =>
    firstToken.includes(p.toLowerCase()) || p.toLowerCase().includes(firstToken),
  );

  if (matched) {
    console.log(`[Wine] 🏭 생산자 감지 (첫토큰): "${tokens[0]}" (패턴: ${matched})`);
    return { hasProducer: true, producer: tokens[0] };
  }

  return { hasProducer: false, producer: '' };
}
