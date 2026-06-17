// 테이스팅노트(한/영 자유 텍스트)에서 향미 키워드를 추출·정규화하고 겹침 점수를 낸다.
// 동의어를 묶어 "buttery≈oaky", "미네랄≈부싯돌" 같은 의미 유사를 흡수한다.
// 정규 키 → 그 키를 잡는 표현들(한/영)
const FLAVOR_GROUPS: Record<string, string[]> = {
  oak: ['oak', 'oaky', 'vanilla', 'butter', 'buttery', 'toast', 'toasty', 'cedar', '오크', '바닐라', '버터', '토스트', '삼나무', '오크향'],
  citrus: ['citrus', 'lemon', 'lime', 'grapefruit', 'orange peel', '시트러스', '레몬', '라임', '자몽', '귤', '오렌지'],
  mineral: ['mineral', 'flint', 'stony', 'saline', 'chalk', 'wet stone', '미네랄', '부싯돌', '돌', '백악', '짠'],
  stonefruit: ['peach', 'apricot', 'nectarine', '복숭아', '살구', '천도'],
  tropical: ['pineapple', 'mango', 'passion', 'tropical', 'lychee', '파인애플', '망고', '패션', '열대', '리치'],
  apple: ['apple', 'pear', 'quince', '사과', '배', '모과'],
  redfruit: ['cherry', 'strawberry', 'raspberry', 'redcurrant', 'cranberry', '체리', '딸기', '라즈베리', '레드커런트', '크랜베리'],
  blackfruit: ['blackberry', 'blackcurrant', 'cassis', 'plum', 'blueberry', '블랙베리', '카시스', '자두', '블루베리', '검은과일'],
  floral: ['floral', 'violet', 'rose', 'jasmine', 'blossom', '플로럴', '제비꽃', '장미', '재스민', '꽃'],
  spice: ['spice', 'pepper', 'clove', 'cinnamon', 'licorice', '스파이스', '후추', '정향', '계피', '감초', '향신료'],
  herb: ['herb', 'herbal', 'thyme', 'mint', 'eucalyptus', 'garrigue', '허브', '민트', '유칼립투스', '타임'],
  earth: ['earth', 'earthy', 'mushroom', 'truffle', 'forest', 'leather', 'tobacco', '흙', '버섯', '트러플', '가죽', '담배', '숲'],
  tannic: ['tannic', 'firm tannin', 'structured', 'grippy', '탄닌', '구조감', '단단한'],
  body_full: ['full body', 'full-bodied', 'rich', 'powerful', 'concentrated', '풀바디', '농축', '파워풀', '진한'],
  body_light: ['light body', 'light-bodied', 'delicate', 'elegant', 'fresh', '라이트', '섬세', '우아', '경쾌', '산뜻'],
  creamy: ['creamy', 'cream', 'lees', 'brioche', '크리미', '크림', '효모', '브리오슈'],
};

// 표현 → 정규 키 역인덱스
const TOKEN_TO_KEY: Array<[string, string]> = [];
for (const [key, words] of Object.entries(FLAVOR_GROUPS)) {
  for (const w of words) TOKEN_TO_KEY.push([w.toLowerCase(), key]);
}

// 정규 향미 키 → 한글 표시 라벨
export const FLAVOR_KO: Record<string, string> = {
  oak: '오크', citrus: '시트러스', mineral: '미네랄', stonefruit: '핵과', tropical: '열대과일',
  apple: '사과·배', redfruit: '붉은과실', blackfruit: '검은과실', floral: '꽃', spice: '향신료',
  herb: '허브', earth: '흙·가죽', tannic: '탄닌', body_full: '풀바디', body_light: '라이트', creamy: '크리미',
};
export function flavorLabel(key: string): string {
  return FLAVOR_KO[key] || key;
}

/** 자유 텍스트에서 정규 향미 키 집합 추출. */
export function extractFlavorKeys(text: string): Set<string> {
  const t = (text || '').toLowerCase();
  const keys = new Set<string>();
  if (!t) return keys;
  for (const [token, key] of TOKEN_TO_KEY) {
    if (t.includes(token)) keys.add(key);
  }
  return keys;
}

/** 거래처 향미키 집합 대비 후보의 겹침 비율(0~1). 거래처 향미가 없으면 0. */
export function flavorOverlap(candidate: Set<string>, client: Set<string>): number {
  if (client.size === 0 || candidate.size === 0) return 0;
  let hit = 0;
  for (const k of candidate) if (client.has(k)) hit++;
  return hit / candidate.size; // 후보 향미 중 거래처 취향과 겹치는 비율
}
