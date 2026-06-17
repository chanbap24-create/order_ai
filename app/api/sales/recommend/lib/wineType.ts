// 와인 타입을 5개 버킷으로 정규화. 추천은 같은 버킷끼리만(교차 금지).
// 우선순위: 스파클링 > 주정강화 > 로제 > 화이트 > 레드 (색 단어가 겹치는 경우 대비)
export type TypeBucket = 'sparkling' | 'fortified' | 'rose' | 'white' | 'red' | '';

const TYPE_RX: Array<[RegExp, TypeBucket]> = [
  [/sparkling|spumante|cr[eé]mant|champagne|샴페인|스파클링|스푸만테|크[레레]망|까바|\bcava\b|prosecco|프로세코|franciacorta|metodo classico|sekt|크레망/i, 'sparkling'],
  [/fortified|\bport\b|porto|tawny|\bruby\b|토니|루비|포트|포르토|sherry|jerez|셰리|madeira|마데이라|marsala|마르살라|vin doux|주정강화|vintage port|빈티지\s*포트/i, 'fortified'],
  [/ros[eé]\b|로제|rosato|rosado/i, 'rose'],
  [/white|blanc|bianco|blanco|화이트|블랑|비앙코|weiss/i, 'white'],
  [/\bred\b|rouge|rosso|tinto|레드|루즈|로쏘|틴토|rotwein/i, 'red'],
];

/** 와인 타입 문자열(+이름 보조)을 5버킷으로. 못 정하면 ''. */
export function normalizeType(rawType: string, name = ''): TypeBucket {
  const s = `${rawType || ''} ${name || ''}`.toLowerCase();
  for (const [re, bucket] of TYPE_RX) if (re.test(s)) return bucket;
  return '';
}

const BUCKET_KO: Record<Exclude<TypeBucket, ''>, string> = {
  sparkling: '스파클링', fortified: '주정강화', rose: '로제', white: '화이트', red: '레드',
};
export function bucketLabel(b: TypeBucket): string {
  return b ? BUCKET_KO[b] : '';
}
