// 국가명 한글 ↔ 영문 매핑

const COUNTRY_MAP: Record<string, string> = {
  // 한글 → 영문
  '미국': 'USA',
  '프랑스': 'France',
  '이탈리아': 'Italy',
  '스페인': 'Spain',
  '칠레': 'Chile',
  '호주': 'Australia',
  '아르헨티나': 'Argentina',
  '독일': 'Germany',
  '포르투갈': 'Portugal',
  '뉴질랜드': 'New Zealand',
  '남아프리카공화국': 'South Africa',
  '남아공': 'South Africa',
  '오스트리아': 'Austria',
  '그리스': 'Greece',
  '헝가리': 'Hungary',
  '이스라엘': 'Israel',
  '레바논': 'Lebanon',
  '캐나다': 'Canada',
  '일본': 'Japan',
  '중국': 'China',
  '조지아': 'Georgia',
  '크로아티아': 'Croatia',
  '슬로베니아': 'Slovenia',
  '루마니아': 'Romania',
  '불가리아': 'Bulgaria',
  '영국': 'England',
  '스위스': 'Switzerland',
  '우루과이': 'Uruguay',
  '브라질': 'Brazil',
  '멕시코': 'Mexico',
  '터키': 'Turkey',
  '몰도바': 'Moldova',
};

// 영문 → 한글 역매핑
const REVERSE_MAP: Record<string, string> = {};
for (const [kr, en] of Object.entries(COUNTRY_MAP)) {
  REVERSE_MAP[en.toUpperCase()] = kr;
}

/** 한글 국가명 → 영문 (없으면 원본 반환) */
export function toEnglishCountry(kr: string): string {
  if (!kr) return '';
  return COUNTRY_MAP[kr.trim()] || kr.trim();
}

/** 영문 국가명 → 한글 (없으면 원본 반환) */
export function toKoreanCountry(en: string): string {
  if (!en) return '';
  return REVERSE_MAP[en.trim().toUpperCase()] || en.trim();
}

/** 영문인지 한글인지 판단하여 반대편 반환 */
export function getCountryPair(name: string): { kr: string; en: string } {
  if (!name) return { kr: '', en: '' };
  const trimmed = name.trim();

  // 한글 문자 포함 여부
  if (/[가-힣]/.test(trimmed)) {
    return { kr: trimmed, en: toEnglishCountry(trimmed) };
  }
  return { kr: toKoreanCountry(trimmed), en: trimmed };
}
