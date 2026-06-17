const SUPER_REGION_MAP: Record<string, string> = {
  '메독 Médoc': 'Bordeaux', '그라브 Graves': 'Bordeaux', '우안 Right Bank': 'Bordeaux',
  '소테른 Sauternes': 'Bordeaux', '기타 보르도': 'Bordeaux',
  '샤블리 Chablis': 'Burgundy', '코트 드 뉘 Côte de Nuits': 'Burgundy',
  '코트 드 본 Côte de Beaune': 'Burgundy', '코트 샬로네즈 Côte Chalonnaise': 'Burgundy',
  '마코네 Mâconnais': 'Burgundy', '광역 Régionale': 'Burgundy',
  '북부 론 Northern Rhône': 'Rhône', '남부 론 Southern Rhône': 'Rhône',
  '상부 루아르 Upper Loire': 'Loire', '투렌 Touraine': 'Loire',
  '앙주소뮈르 Anjou-Saumur': 'Loire', '낭트 Nantais': 'Loire',
  '알자스 Alsace': 'Alsace', '샴페인 Champagne': 'Champagne',
  '랑그독 Languedoc': 'Languedoc-Roussillon', '루시용 Roussillon': 'Languedoc-Roussillon',
  '프로방스 Provence': 'Provence', '쥐라 Jura': 'Jura-Savoie', '사부아 Savoie': 'Jura-Savoie',
  '남서부 Sud-Ouest': 'Sud-Ouest', '코르시카 Corsica': 'Corsica',
};

// 광역(super) 산지 키워드 — 빌리지/밭이 안 잡혀도 광역 라벨("Bourgogne" 등)은 인식.
// 값은 SUPER_REGION_MAP 의 super_region 과 일치시켜야 후보 와인과 매칭됨.
const SUPER_KEYWORDS: Array<[RegExp, string]> = [
  [/bourgogne|burgundy|부르고뉴/i, 'Burgundy'],
  [/bordeaux|보르도/i, 'Bordeaux'],
  [/champagne|샴페인|샹파뉴/i, 'Champagne'],
  [/rh[oô]ne|론\b/i, 'Rhône'],
  [/loire|루아르/i, 'Loire'],
  [/alsace|알자스/i, 'Alsace'],
  [/languedoc|roussillon|랑그독|루시용/i, 'Languedoc-Roussillon'],
  [/provence|프로방스/i, 'Provence'],
  [/jura|savoie|쥐라|사부아/i, 'Jura-Savoie'],
  [/sud[-\s]?ouest|south\s*west|남서부/i, 'Sud-Ouest'],
  [/corsica|corse|코르시카/i, 'Corsica'],
];

/** 산지/와인명 문자열에서 광역(super) 산지를 감지. 없으면 ''. */
export function detectSuperRegion(text: string): string {
  const t = text || '';
  for (const [re, sup] of SUPER_KEYWORDS) if (re.test(t)) return sup;
  return '';
}

export function extractEnglish(bilingual: string): string {
  const parts = bilingual.split(/\s+/);
  const enIdx = parts.findIndex((p) => /^[A-ZÀ-ÿ]/.test(p));
  if (enIdx >= 0) return parts.slice(enIdx).join(' ');
  return bilingual;
}

// 등급 약어(DO/DOC/AOC 등)·괄호주석 제거 후 영문 지명만 추출. 짧으면 매칭에서 제외.
// "리마리 밸리 DO" → "" (등급만 있음), "Margaux AOC" → "margaux", "도우루 Douro" → "douro"
const CLASS_WORDS = /\b(docg|doca|doc|dop|do|aoc|aop|ava|igt|igp|vdp|aova)\b/g;
function cleanRegionToken(bilingual: string): string {
  return extractEnglish(bilingual || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(CLASS_WORDS, ' ')
    .replace(/\b1er cru\b|\bpremier cru\b|\bgrand cru\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 비교용 정규화: 발음기호 제거 + 영숫자만 남김(악센트·하이픈·공백·구두점 차이 무시).
// "Châteauneuf-du-Pape" / "Chateauneuf du Pape" → "chateauneufdupape", "Mc Laren Vale" → "mclarenvale"
function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 단어 단위 정규화(공백 유지) — cru 를 region 과 "단어 경계"로 비교하기 위함.
// region "Champagne, Oger" 안의 "Oger"(단어)만 매칭, "Roger"(생산자명) 같은 조각은 제외.
function nWords(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// 국가 비교 키: 영문부 정규화 + 흔한 별칭 통일(USA/United States, England/UK 등)
export function countryKey(s: string): string {
  const n = norm(extractEnglish(s || ''));
  if (/unitedstate|^usa$|^us$|america/.test(n)) return 'usa';
  if (/unitedkingdom|britain|^uk$|england|^gb$/.test(n)) return 'england';
  return n;
}

export interface RegionHierarchy {
  sub_region: string;
  major_region: string;
  super_region: string;
  classification: string;
}

export interface WineRegionRow {
  country?: string | null;
  sub_region: string | null;
  major_region: string;
  appellation: string | null;
  cru_vineyard: string | null;
  classification: string | null;
}

/**
 * findHierarchy 와 동일한 스코어링으로 "가장 잘 맞는 wine_regions 행"을 반환.
 * (findHierarchy 는 계층 문자열을 반환 — 이쪽은 행 객체를 반환해 국가/대지역별 집계에 사용)
 */
export function matchRegionRow<T extends WineRegionRow>(
  wineRegion: string,
  wineName: string,
  regionRows: T[],
  wineCountry?: string,
): { row: T; exact: boolean } | null {
  if (!wineRegion && !wineName) return null;

  // 와인 국가가 주어지면 그 나라 산지로만 매칭(타국 오매칭 차단: 칠레→이탈리아, 미국→프랑스 등).
  // 해당 국가 산지 행이 하나도 없으면 미분류(억지로 타국에 넣지 않음).
  let rows = regionRows;
  if (wineCountry) {
    const ck = countryKey(wineCountry);
    const same = regionRows.filter((r) => countryKey(r.country || '') === ck);
    if (same.length === 0) return null;
    rows = same;
  }

  const regionLower = (wineRegion || '').toLowerCase();
  const parts = regionLower.split(',').map((p) => p.trim()).filter(Boolean);
  const specific = parts[0] || '';
  const sName = norm(specific), rName = norm(regionLower);
  const regionW = ` ${nWords(regionLower)} `;

  let best: T | null = null;
  let bestScore = 0;
  for (const row of rows) {
    // 정규화 비교(악센트/하이픈/공백 무시) + 등급약어 제거 + 최소 길이 가드(catch-all 방지)
    const subN = norm(cleanRegionToken(row.sub_region || ''));
    const appN = norm(cleanRegionToken(row.appellation || ''));
    // 분류는 와인 "이름"이 아니라 region 필드로만 — cru 도 region 에 단어로 있을 때만(이름 조각 오매칭 방지)
    const cruP = nWords(extractEnglish(row.cru_vineyard || '').replace(/\(.*?\)/g, ' '));
    let score = 0;
    if (cruP.length >= 4 && regionW.includes(` ${cruP} `)) score = 100;
    else if (appN.length >= 4 && sName.includes(appN)) score = 80;
    // 정방향만: DB 산지명이 와인 region 에 포함될 때만(역방향은 "lodi"⊂"cerasuoLODIvittoria" 같은 조각 오매칭)
    else if (subN.length >= 4 && sName.includes(subN)) score = 60;
    else if (subN.length >= 4 && rName.includes(subN)) score = 40;
    // 와인 "이름" 기반 sub 매칭은 제거 — 맛/품종 단어(오렌지 등) 오매칭 방지. 산지는 region 필드로만.
    else {
      const majorN = norm(cleanRegionToken(row.major_region || ''));
      if (majorN.length >= 4 && (sName.includes(majorN) || rName.includes(majorN))) score = 35;
    }
    if (score > bestScore) { bestScore = score; best = row; }
  }
  if (best && bestScore >= 30) return { row: best, exact: true };

  // 광역 폴백: 빌리지/밭이 안 잡혔지만 광역 라벨이면, 그 광역의 대표 행으로 매칭(정확도 낮음)
  const sup = detectSuperRegion(wineRegion);
  if (sup) {
    const rep = rows.find((r) => SUPER_REGION_MAP[r.major_region] === sup);
    if (rep) return { row: rep, exact: false };
  }
  return null;
}

/**
 * wine region 문자열 + wine name으로 wine_regions 테이블에서 계층을 찾음.
 * cru > appellation > sub_region 순으로 매칭 후 score 높은 것 채택.
 */
export function findHierarchy(
  wineRegion: string,
  wineName: string,
  regionRows: WineRegionRow[],
): RegionHierarchy | null {
  if (!wineRegion && !wineName) return null;
  const regionLower = (wineRegion || '').toLowerCase();
  const parts = regionLower.split(',').map((p) => p.trim()).filter(Boolean);
  const specific = parts[0] || '';
  const sName = norm(specific), rName = norm(regionLower);
  const regionW = ` ${nWords(regionLower)} `;

  let bestMatch: WineRegionRow | null = null;
  let bestScore = 0;

  for (const row of regionRows) {
    // matchRegionRow 와 동일한 정규화 스코어링(악센트/하이픈/공백 무시 + 최소 길이 가드)
    const subN = norm(cleanRegionToken(row.sub_region || ''));
    const appN = norm(cleanRegionToken(row.appellation || ''));
    // 분류는 와인 "이름"이 아니라 region 필드로만 — cru 도 region 에 단어로 있을 때만(이름 조각 오매칭 방지)
    const cruP = nWords(extractEnglish(row.cru_vineyard || '').replace(/\(.*?\)/g, ' '));
    let score = 0;
    if (cruP.length >= 4 && regionW.includes(` ${cruP} `)) score = 100;
    else if (appN.length >= 4 && sName.includes(appN)) score = 80;
    // 정방향만: DB 산지명이 와인 region 에 포함될 때만(역방향은 "lodi"⊂"cerasuoLODIvittoria" 같은 조각 오매칭)
    else if (subN.length >= 4 && sName.includes(subN)) score = 60;
    else if (subN.length >= 4 && rName.includes(subN)) score = 40;
    // 와인 "이름" 기반 sub 매칭은 제거 — 맛/품종 단어 오매칭 방지. 산지는 region 필드로만.
    else {
      const majorN = norm(cleanRegionToken(row.major_region || ''));
      if (majorN.length >= 4 && (sName.includes(majorN) || rName.includes(majorN))) score = 35;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }

  if (!bestMatch || bestScore < 30) {
    // 광역 폴백: 빌리지/밭 매칭 실패 시, 광역 라벨("Bourgogne" 등)만이라도 super_region 으로 인정.
    // → 광역 단위 산지 선호가 추천에 반영되어, 국가(미국 등)로의 폴백을 줄인다.
    const sup = detectSuperRegion(wineRegion);
    if (sup) {
      const text = `${wineName} ${wineRegion}`.toLowerCase();
      let cls = '';
      if (/grand\s*cru/.test(text) || text.includes('그랑 크뤼')) cls = 'Grand Cru';
      else if (/1er\s*cru|premier\s*cru/.test(text) || text.includes('프리미에 크뤼')) cls = 'Premier Cru';
      return { sub_region: '', major_region: '', super_region: sup, classification: cls };
    }
    return null;
  }

  const subRegion = bestMatch.sub_region || bestMatch.major_region;
  const majorRegion = bestMatch.major_region;
  const superRegion = SUPER_REGION_MAP[majorRegion] || '';

  let classification = bestMatch.classification || '';
  const text = `${wineName} ${wineRegion}`.toLowerCase();
  const hasGrandCru = /grand\s*cru/.test(text) || text.includes('그랑 크뤼');
  if (hasGrandCru && !/classé|classe/.test(text)) classification = 'Grand Cru';
  else if (/1er\s*cru|premier\s*cru/.test(text) || text.includes('프리미에 크뤼')) classification = 'Premier Cru';

  return { sub_region: subRegion, major_region: majorRegion, super_region: superRegion, classification };
}
