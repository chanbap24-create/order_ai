export const BRAND_COUNTRY: Record<string, string> = {
  CH:'프랑스',LV:'프랑스',VA:'프랑스',ST:'스페인',MS:'이탈리아',WM:'프랑스',
  DE:'프랑스',HP:'미국',IC:'프랑스',DC:'프랑스',VC:'프랑스',DD:'프랑스',
  GH:'포르투갈',MM:'스페인',MR:'프랑스',MG:'프랑스',MB:'미국',CF:'프랑스',
  AD:'미국',TM:'미국',DF:'프랑스',OR:'이탈리아',CC:'프랑스',CO:'포르투갈',
  VG:'프랑스',LM:'프랑스',SM:'스페인',BL:'프랑스',RB:'프랑스',CK:'아르헨티나',
  SU:'프랑스',RO:'호주',LG:'프랑스',BR:'이탈리아',CD:'프랑스',CP:'프랑스',
  RG:'미국',BS:'이탈리아',AS:'이탈리아',AZ:'이탈리아',GT:'호주',FC:'이탈리아',RF:'영국',
};

// 품번 첫 글자 기반 상품 분류
export const ITEM_CATEGORY_MAP: Record<string, string> = {
  '0': 'Champagne', '1': 'Sparkling', '2': 'Red', '3': 'White',
  '4': 'Rosé', '5': 'Icewine', '6': 'Grappa', '7': 'Set',
  '8': 'POS Material', '9': '자재',
  'A': 'Port', 'Z': '타사제품',
};

export const WINE_CODES = new Set('0123456789AZ'.split(''));

export function getItemCategory(itemNo: string): string | null {
  const first = (itemNo || '').charAt(0).toUpperCase();
  return ITEM_CATEGORY_MAP[first] || null;
}

// 품명에서 용량 추출
export function inferVolume(itemName: string): string {
  const n = itemName || '';
  if (/3\s*L\b|3000\s*ml/i.test(n)) return '3L';
  if (/1\.5\s*L\b|1500\s*ml/i.test(n)) return '1.5L';
  if (/500\s*ml/i.test(n)) return '500ml';
  if (/375\s*ml/i.test(n)) return '375ml';
  if (/187\s*ml/i.test(n)) return '187ml';
  return '750ml';
}

// 국가명 정규화
const COUNTRY_NORMALIZE: Record<string, string> = {
  'United States': '미국', 'USA': '미국', 'US': '미국',
  'France': '프랑스', 'Italy': '이탈리아', 'Spain': '스페인',
  'Germany': '독일', 'Australia': '호주', 'Chile': '칠레',
  'Argentina': '아르헨티나', 'Portugal': '포르투갈',
  'New Zealand': '뉴질랜드', 'Austria': '오스트리아',
  'South Africa': '남아공', 'Hungary': '헝가리', 'UK': '영국',
};

export function normalizeCountry(c: string | null): string | null {
  if (!c) return null;
  return COUNTRY_NORMALIZE[c] || c;
}

export function extractBrandCode(itemName: string): string | null {
  const m = (itemName || '').match(/^([A-Z]{2,3})\s/);
  return m ? m[1] : null;
}
