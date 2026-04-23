const GRAPE_PATTERNS: { pattern: RegExp; grape: string }[] = [
  { pattern: /카베르네\s?소비뇽|cabernet\s?sauvignon/i, grape: 'Cabernet Sauvignon' },
  { pattern: /소비뇽\s?블랑|sauvignon\s?blanc/i, grape: 'Sauvignon Blanc' },
  { pattern: /피노\s?누아|피노누아|pinot\s?noir/i, grape: 'Pinot Noir' },
  { pattern: /샤르도네|chardonnay/i, grape: 'Chardonnay' },
  { pattern: /메를로|merlot/i, grape: 'Merlot' },
  { pattern: /시라|쉬라즈|syrah|shiraz/i, grape: 'Syrah' },
  { pattern: /리슬링|riesling/i, grape: 'Riesling' },
  { pattern: /말벡|malbec/i, grape: 'Malbec' },
  { pattern: /템프라니요|tempranillo/i, grape: 'Tempranillo' },
  { pattern: /산지오베제|sangiovese/i, grape: 'Sangiovese' },
  { pattern: /네비올로|nebbiolo/i, grape: 'Nebbiolo' },
  { pattern: /그르나슈|그르나쉬|grenache|garnacha/i, grape: 'Grenache' },
  { pattern: /진판델|zinfandel/i, grape: 'Zinfandel' },
  { pattern: /까베르네\s?프랑|cabernet\s?franc/i, grape: 'Cabernet Franc' },
  { pattern: /비오니에|viognier/i, grape: 'Viognier' },
  { pattern: /피노\s?그리|피노그리|pinot\s?gri[sg]/i, grape: 'Pinot Grigio' },
  { pattern: /모스카토|moscato|뮈스까|muscat/i, grape: 'Moscato' },
  { pattern: /프리미티보|primitivo/i, grape: 'Primitivo' },
  { pattern: /가메|gamay/i, grape: 'Gamay' },
  { pattern: /바르베라|barbera/i, grape: 'Barbera' },
  { pattern: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|모레\s?생|본\s?로마네|몽텔리|상트네/i, grape: 'Pinot Noir' },
  { pattern: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, grape: 'Chardonnay' },
  { pattern: /비온디\s?산티|BdM/i, grape: 'Sangiovese' },
  { pattern: /보졸레/i, grape: 'Gamay' },
];

const TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /스파클링|sparkling|크레망|cremant|프로세코|prosecco|까바|cava/i, type: '스파클링' },
  { pattern: /샴페인|champagne|샹파뉴|찰스\s?하이직|브륏|brut/i, type: '스파클링' },
  { pattern: /로제|rosé|rose(?!\s*(마리|골드|와인))/i, type: '로제' },
  { pattern: /소비뇽\s?블랑|샤르도네|리슬링|비오니에|피노\s?그리|모스카토|뮈스까|알바리뇨/i, type: '화이트' },
  { pattern: /블랑|bianco|blanc|white|비앙코|화이트|브랑코|branco/i, type: '화이트' },
  { pattern: /카베르네|피노\s?누아|피노누아|메를로|시라|쉬라즈|말벡|템프라니요|산지오베제|네비올로|그르나슈|진판델|프리미티보|가메|바르베라/i, type: '레드' },
  { pattern: /루쥬|루즈|rosso|rouge|레드|tinto/i, type: '레드' },
  { pattern: /브루넬로|바롤로|바르바레스코|아마로네|키안티|리오하|BdM|비온디\s?산티/i, type: '레드' },
  { pattern: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|뉘이\s?생|모레\s?생|본\s?로마네|몽텔리|상트네|보졸레/i, type: '레드' },
  { pattern: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, type: '화이트' },
  { pattern: /마고|뽀이약|생\s?테밀리옹|뻬삭|메독|오\s?메독|생\s?줄리앙|생\s?에스텝/i, type: '레드' },
  { pattern: /꼬뜨\s?뒤\s?론|샤또뇌프\s?뒤\s?빠프|가르딘/i, type: '레드' },
];

export function extractGrapesFromName(name: string): string[] {
  if (!name) return [];
  const grapes: string[] = [];
  for (const { pattern, grape } of GRAPE_PATTERNS) {
    if (pattern.test(name)) grapes.push(grape);
  }
  return grapes;
}

export function extractTypeFromName(name: string): string {
  if (!name) return '';
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return '';
}

export function getSeasonInfo(month: number): { season: string; types: string[]; grapes: string[] } {
  if (month >= 3 && month <= 5) return { season: '봄', types: ['로제', 'Rose', 'Rosé'], grapes: ['Sauvignon Blanc', 'Riesling'] };
  if (month >= 6 && month <= 8) return { season: '여름', types: ['스파클링', 'Sparkling', '화이트', 'White', '로제'], grapes: [] };
  if (month >= 9 && month <= 11) return { season: '가을', types: [], grapes: ['Pinot Noir'] };
  return { season: '겨울', types: [], grapes: ['Syrah', 'Cabernet Sauvignon'] };
}
