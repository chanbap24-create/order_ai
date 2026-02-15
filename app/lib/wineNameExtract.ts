// 와인 이름에서 품종/타입 추출 (공유 모듈)

const GRAPE_PATTERNS: { p: RegExp; g: string }[] = [
  { p: /카베르네\s?소비뇽|cabernet\s?sauvignon/i, g: 'Cabernet Sauvignon' },
  { p: /소비뇽\s?블랑|sauvignon\s?blanc/i, g: 'Sauvignon Blanc' },
  { p: /피노\s?누아|피노누아|pinot\s?noir/i, g: 'Pinot Noir' },
  { p: /샤르도네|chardonnay/i, g: 'Chardonnay' },
  { p: /메를로|merlot/i, g: 'Merlot' },
  { p: /시라|쉬라즈|syrah|shiraz/i, g: 'Syrah' },
  { p: /리슬링|riesling/i, g: 'Riesling' },
  { p: /말벡|malbec/i, g: 'Malbec' },
  { p: /템프라니요|tempranillo/i, g: 'Tempranillo' },
  { p: /산지오베제|sangiovese/i, g: 'Sangiovese' },
  { p: /네비올로|nebbiolo/i, g: 'Nebbiolo' },
  { p: /그르나슈|그르나쉬|grenache|garnacha/i, g: 'Grenache' },
  { p: /무르베드르|mourvedre|mourvèdre/i, g: 'Mourvedre' },
  { p: /진판델|zinfandel/i, g: 'Zinfandel' },
  { p: /까베르네\s?프랑|cabernet\s?franc/i, g: 'Cabernet Franc' },
  { p: /비오니에|viognier/i, g: 'Viognier' },
  { p: /피노\s?그리|피노그리|pinot\s?gri[sg]/i, g: 'Pinot Grigio' },
  { p: /겨르츠트라미너|게뷔르츠|gewurz|gewürz/i, g: 'Gewurztraminer' },
  { p: /모스카토|moscato|뮈스까|muscat/i, g: 'Moscato' },
  { p: /프리미티보|primitivo/i, g: 'Primitivo' },
  { p: /가메|gamay/i, g: 'Gamay' },
  { p: /알바리뇨|albariño|albarino/i, g: 'Albarino' },
  { p: /트레비아노|trebbiano/i, g: 'Trebbiano' },
  { p: /바르베라|barbera/i, g: 'Barbera' },
  { p: /그뤼너\s?벨트리너|gruner\s?veltliner/i, g: 'Gruner Veltliner' },
  { p: /세미용|semillon|sémillon/i, g: 'Semillon' },
  { p: /쁘띠\s?베르도|petit\s?verdot/i, g: 'Petit Verdot' },
  // 지역명 기반
  { p: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|모레\s?생|본\s?로마네|몽텔리|상트네/i, g: 'Pinot Noir' },
  { p: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, g: 'Chardonnay' },
  { p: /비온디\s?산티|BdM/i, g: 'Sangiovese' },
  { p: /보졸레/i, g: 'Gamay' },
];

const TYPE_PATTERNS: { p: RegExp; t: string }[] = [
  { p: /스파클링|sparkling|크레망|cremant|crémant|프로세코|prosecco|까바|cava|제트|sekt/i, t: '스파클링' },
  { p: /샴페인|champagne|샹파뉴|찰스\s?하이직|브륏|brut/i, t: '스파클링' },
  { p: /로제|rosé|rose(?!\s*(마리|골드|와인))/i, t: '로제' },
  { p: /소비뇽\s?블랑|샤르도네|리슬링|비오니에|피노\s?그리|게뷔르츠|모스카토|뮈스까|알바리뇨|트레비아노|그뤼너|세미용/i, t: '화이트' },
  { p: /블랑|bianco|blanc|white|비앙코|화이트|브랑코|branco/i, t: '화이트' },
  { p: /카베르네|피노\s?누아|피노누아|메를로|시라|쉬라즈|말벡|템프라니요|산지오베제|네비올로|그르나슈|진판델|프리미티보|가메|바르베라/i, t: '레드' },
  { p: /루쥬|루즈|rosso|rouge|레드|tinto/i, t: '레드' },
  { p: /브루넬로|바롤로|바르바레스코|아마로네|키안티|리오하|BdM|비온디\s?산티/i, t: '레드' },
  { p: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|뉘이\s?생|모레\s?생|본\s?로마네|몽텔리|상트네|보졸레/i, t: '레드' },
  { p: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, t: '화이트' },
  { p: /마고|뽀이약|생\s?테밀리옹|뻬삭|메독|오\s?메독|생\s?줄리앙|생\s?에스텝/i, t: '레드' },
  { p: /꼬뜨\s?뒤\s?론|샤또뇌프\s?뒤\s?빠프|가르딘/i, t: '레드' },
  { p: /포트|쉐리|셰리|마데이라|port|sherry|madeira|마르살라/i, t: '주정강화' },
  { p: /그라파|grappa/i, t: '증류주' },
];

/** 와인 이름에서 품종 추출 */
export function extractGrapesFromName(name: string): string {
  if (!name) return '';
  const grapes: string[] = [];
  for (const { p, g } of GRAPE_PATTERNS) {
    if (p.test(name) && !grapes.includes(g)) grapes.push(g);
  }
  return grapes.join(', ');
}

/** 와인 이름에서 타입 추출 */
export function extractTypeFromName(name: string): string {
  if (!name) return '';
  for (const { p, t } of TYPE_PATTERNS) {
    if (p.test(name)) return t;
  }
  return '';
}
