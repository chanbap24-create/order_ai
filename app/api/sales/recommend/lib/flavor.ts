// 테이스팅노트(한/영 자유 텍스트)에서 향미 키워드를 추출·정규화하고 겹침 점수를 낸다.
// 세분화 어휘 V2(~52키, aroma wheel 기반) — 굵은 16개는 변별력이 낮아 세분화함.
// 정규 키 → 그 키를 잡는 표현들(한/영)
const FLAVOR_GROUPS: Record<string, string[]> = {
  // 시트러스
  lemon: ['lemon zest', 'lemon', '레몬'], lime: ['lime', '라임'], grapefruit: ['grapefruit', '자몽'],
  // 청과/과수원
  green_apple: ['green apple', 'granny smith', '풋사과', '청사과'], apple: ['red apple', 'apple', '사과'],
  pear: ['pear', '배', '서양배'], quince: ['quince', '모과'],
  // 핵과
  peach: ['white peach', 'peach', '복숭아', '백도', '황도'], apricot: ['apricot', 'nectarine', '살구', '천도'],
  // 열대
  pineapple: ['pineapple', '파인애플'], mango: ['mango', '망고'], passionfruit: ['passion fruit', 'passion', '패션프루트', '패션'],
  lychee: ['lychee', '리치'], melon: ['melon', '멜론'],
  // 붉은 과실
  cherry: ['black cherry', 'cherry', '체리', '버찌'], strawberry: ['strawberry', '딸기'],
  raspberry: ['raspberry', '산딸기', '라즈베리'], redcurrant: ['redcurrant', 'red currant', 'cranberry', '레드커런트', '크랜베리'],
  // 검은 과실
  blackberry: ['blackberry', '블랙베리'], blackcurrant: ['blackcurrant', 'cassis', '카시스', '블랙커런트'],
  plum: ['plum', 'prune', '자두', '프룬'], blueberry: ['blueberry', '블루베리'],
  dried_fruit: ['dried fig', 'raisin', 'sultana', 'date', '무화과', '건포도', '건과일'],
  // 꽃
  violet: ['violet', '제비꽃'], rose: ['rose', '장미'],
  floral_white: ['jasmine', 'orange blossom', 'acacia', 'blossom', '재스민', '아카시아', '꽃향', '화이트플라워'],
  elderflower: ['elderflower', 'honeysuckle', '엘더플라워', '인동'],
  // 허브/식물
  mint: ['mint', 'menthol', '민트', '박하'], eucalyptus: ['eucalyptus', '유칼립투스'],
  herb_green: ['thyme', 'sage', 'garrigue', 'herbal', 'dried herb', '타임', '세이지', '허브'],
  green_pepper: ['green pepper', 'bell pepper', 'capsicum', 'pyrazine', '피망', '풋고추'],
  grassy: ['cut grass', 'grassy', 'herbaceous', 'green', '풋내', '풀'],
  // 향신료
  black_pepper: ['black pepper', 'white pepper', 'peppercorn', '후추', '흑후추'],
  sweet_spice: ['clove', 'cinnamon', 'nutmeg', 'star anise', '정향', '계피', '넛맥', '팔각'],
  licorice: ['licorice', 'liquorice', 'anise', '감초', '아니스'],
  // 오크/숙성
  vanilla: ['vanilla', '바닐라'], toast: ['toasted', 'toast', 'toasty', 'char', 'smoke', 'smoky', '토스트', '스모크', '탄'],
  cedar: ['cedar', 'sandalwood', '삼나무', '시더'], coffee_choc: ['espresso', 'coffee', 'mocha', 'chocolate', 'cocoa', '커피', '모카', '초콜릿', '카카오'],
  coconut: ['coconut', '코코넛'],
  // 흙/savory
  mushroom: ['mushroom', 'truffle', '버섯', '트러플'], forest_floor: ['forest floor', 'undergrowth', 'damp earth', 'earthy', '부엽토', '흙', '숲'],
  leather_tobacco: ['leather', 'tobacco', 'cigar box', 'cigar', '가죽', '담배', '시가'],
  game_meat: ['gamey', 'game', 'cured meat', 'savory', 'meaty', 'bacon', '육류', '훈연', '고기'],
  tar: ['tar', 'asphalt', 'graphite', '타르', '흑연'],
  // 미네랄
  flint: ['flint', 'gunflint', 'struck match', '부싯돌', '성냥'], wet_stone: ['wet stone', 'wet rock', 'stony', 'slate', 'crushed rock', '젖은 돌', '슬레이트', '돌'],
  chalk: ['chalk', 'chalky', '백악', '분필'], saline: ['saline', 'salty', 'sea spray', 'iodine', 'briny', '짠', '바다', '요오드'],
  petrol: ['petrol', 'kerosene', 'diesel', '석유', '휘발유'],
  // 유제품/효모/견과/꿀
  butter: ['buttery', 'butter', '버터'], cream: ['creamy', 'cream', '크림', '크리미'],
  brioche_yeast: ['brioche', 'lees', 'yeast', 'bread', 'biscuit', 'pastry', '브리오슈', '효모', '빵', '비스킷'],
  nutty: ['almond', 'hazelnut', 'walnut', 'nutty', '아몬드', '헤이즐넛', '호두', '견과'], honey: ['honey', 'beeswax', '꿀', '벌집'],
  // 구조/바디
  tannic: ['tannic', 'firm tannin', 'grippy tannin', 'structured', '탄닌', '구조감', '단단한'],
  full_body: ['full body', 'full-bodied', 'rich', 'powerful', 'concentrated', '풀바디', '농축', '파워풀', '진한'],
  light_body: ['light body', 'light-bodied', 'delicate', 'elegant', 'crisp', 'fresh', '라이트', '섬세', '우아', '경쾌', '산뜻'],
};

// 표현 → 정규 키 역인덱스
const TOKEN_TO_KEY: Array<[string, string]> = [];
for (const [key, words] of Object.entries(FLAVOR_GROUPS)) {
  for (const w of words) TOKEN_TO_KEY.push([w.toLowerCase(), key]);
}

// 정규 향미 키 → 한글 표시 라벨
export const FLAVOR_KO: Record<string, string> = {
  lemon: '레몬', lime: '라임', grapefruit: '자몽',
  green_apple: '청사과', apple: '사과', pear: '배', quince: '모과',
  peach: '복숭아', apricot: '살구',
  pineapple: '파인애플', mango: '망고', passionfruit: '패션프루트', lychee: '리치', melon: '멜론',
  cherry: '체리', strawberry: '딸기', raspberry: '라즈베리', redcurrant: '레드커런트',
  blackberry: '블랙베리', blackcurrant: '카시스', plum: '자두', blueberry: '블루베리', dried_fruit: '말린과일',
  violet: '제비꽃', rose: '장미', floral_white: '흰꽃', elderflower: '엘더플라워',
  mint: '민트', eucalyptus: '유칼립투스', herb_green: '허브', green_pepper: '피망', grassy: '풀향',
  black_pepper: '후추', sweet_spice: '단향신료', licorice: '감초',
  vanilla: '바닐라', toast: '토스트', cedar: '삼나무', coffee_choc: '커피·초콜릿', coconut: '코코넛',
  mushroom: '버섯', forest_floor: '부엽토', leather_tobacco: '가죽·담배', game_meat: '육향', tar: '타르',
  flint: '부싯돌', wet_stone: '젖은돌', chalk: '백악', saline: '짠맛', petrol: '석유',
  butter: '버터', cream: '크림', brioche_yeast: '브리오슈', nutty: '견과', honey: '꿀',
  tannic: '탄닌', full_body: '풀바디', light_body: '라이트',
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
