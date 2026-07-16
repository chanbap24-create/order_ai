// 와인 타입을 6개 버킷으로 정규화. 추천은 같은 버킷끼리만(교차 금지).
// 우선순위: 주정강화 > 스위트 > 스파클링 > 로제 > 화이트 > 레드 (당도/발포 겹칠 때 대비)
//   스위트(모스카토·아스티·소테른 등)는 스파클링/화이트보다 먼저 잡아 분리 — 브륏 고객에 스위트 안 섞이게.
export type TypeBucket = 'sparkling' | 'fortified' | 'rose' | 'white' | 'red' | 'sweet' | '';

const TYPE_RX: Array<[RegExp, TypeBucket]> = [
  [/fortified|\bport\b|porto|tawny|\bruby\b|토니|루비|포트|포르토|sherry|jerez|셰리|madeira|마데이라|marsala|마르살라|vin doux|주정강화|vintage port|빈티지\s*포트/i, 'fortified'],
  [/moscato|모스카토|모스까토|무스까|\basti\b|아스티|sauternes|소테른|tokaji|토카이|ice\s?wine|아이스\s?와인|late\s?harvest|귀부|beerenauslese|trockenbeerenauslese|스위트\s?와인|dolce|돌체|demi.?sec|드미.?섹|dessert|디저트\s?와인/i, 'sweet'],
  [/sparkling|spumante|cr[eé]mant|champagne|샴페인|스파클링|스푸만테|크[레레]망|까바|\bcava\b|prosecco|프로세코|franciacorta|metodo classico|sekt|크레망/i, 'sparkling'],
  [/ros[eé]\b|로제|rosato|rosado/i, 'rose'],
  [/white|blanc|bianco|blanco|화이트|블랑|비앙코|weiss/i, 'white'],
  // 레드 전용 품종명도 힌트로 (로제·화이트는 우선순위가 위라 '카베르네 로제' 등은 안전)
  [/\bred\b|rouge|rosso|tinto|레드|루즈|로쏘|틴토|rotwein|cabernet|카베르네|까베르네|merlot|메를로|pinot\s?noir|피노\s?누아/i, 'red'],
];

/** 와인 타입 문자열(+이름 보조)을 6버킷으로. 무알콜/스피릿은 와인 아님 → ''. 못 정하면 ''. */
export function normalizeType(rawType: string, name = ''): TypeBucket {
  const s = `${rawType || ''} ${name || ''}`.toLowerCase();
  // 무알콜/논알콜/스피릿(무알콜 발포음료 등)은 와인 아님 → 제외
  if (/무알콜|논알콜|무알코올|non.?alcohol|알코?올\s?프리|de.?alcohol|\b스피릿\b|\bspirit|스프리츠|스프릿츠|spritz|리제로/i.test(s)) return '';
  for (const [re, bucket] of TYPE_RX) if (re.test(s)) return bucket;
  return '';
}

const BUCKET_KO: Record<Exclude<TypeBucket, ''>, string> = {
  sparkling: '스파클링', fortified: '주정강화', rose: '로제', white: '화이트', red: '레드', sweet: '스위트',
};
export function bucketLabel(b: TypeBucket): string {
  return b ? BUCKET_KO[b] : '';
}
