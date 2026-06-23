// 병 용량 판별(품명 기반). wines/inventory에 용량 컬럼이 없어 이름에서 추출.
// 추천은 기본 750ml 표준만 — 375ml(하프)·1.5L 이상(매그넘 이상)은 현장에서 잘 안 써서 제외.
// 영업사원이 버튼으로 포함할 수 있음.
const HALF_RX = /(?:^|[^0-9])(?:375|187)(?:\s*ml)?(?:[^0-9]|$)|하프|\bhalf\b/i;
const LARGE_RX = /1[.,]5\s*l|1500\s*ml|매그넘|magnum|\b3\s*l\b|3000\s*ml|\b6\s*l\b|6000\s*ml|제로보암|jeroboam|더블\s*매그넘|살마나자르/i;

/** 750ml 표준이 아닌 병(하프 375ml 또는 매그넘 이상 1.5L+)인지. */
export function isNonStandardBottle(name: string): boolean {
  const s = name || '';
  return HALF_RX.test(s) || LARGE_RX.test(s);
}

// 기프트박스(GB). 와인명 끝의 'GB' 또는 기프트박스/gift box 표기 → 선물용 패키지라 추천에서 항상 제외.
const GIFT_RX = /\bGB\s*$|기프트\s*박스|기프트셋|gift\s*box/i;
export function isGiftBox(name: string): boolean {
  return GIFT_RX.test(name || '');
}
