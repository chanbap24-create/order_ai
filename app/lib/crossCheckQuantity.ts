// app/lib/crossCheckQuantity.ts
// 원문(query)에서 규칙기반으로 수량을 추출하여 LLM 파싱 결과와 크로스체크
// 추가 API 호출 없이 순수 regex — 속도 영향 거의 없음

interface QtyCheckResult {
  /** 규칙기반으로 추출한 수량 (null이면 추출 불가) */
  ruleQty: number | null;
  /** LLM이 반환한 수량 */
  llmQty: number;
  /** 불일치 여부 */
  mismatch: boolean;
  /** 경고 메시지 (불일치 시) */
  warning?: string;
}

/**
 * 원문 query 한 줄에서 수량을 규칙기반으로 추출
 * parseItemsFromMessage와 동일한 패턴을 사용하되, 단일 라인용으로 경량화
 */
function extractQtyFromQuery(query: string): number | null {
  let raw = String(query || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  // 꼬리말 제거
  raw = raw.replace(/(?:\s|^)+(발주요청드립니다|발주 요청드립니다|주문요청드립니다|주문 요청드립니다|요청드립니다|부탁드립니다|부탁드려요|해주세요|주세요)(?=\s|$|[.,!~…])/g, ' ').trim();

  // 연도 분리
  let yearHint: string | null = null;
  raw = raw.replace(/^(19\d{2}|20\d{2})(?=[가-힣A-Za-z])/g, '$1 ');

  // 선두 연도 떼기
  const yFront = raw.match(/^(19\d{2}|20\d{2})\s+(.+)$/);
  if (yFront) {
    yearHint = yFront[1];
    raw = yFront[2].trim();
  }

  // 말미 연도 떼기 (4자리)
  const yBack = raw.match(/^(.+?)\s+(19\d{2}|20\d{2})\s*$/);
  if (yBack) {
    yearHint = yearHint ?? yBack[2];
    raw = yBack[1].trim();
  }

  // 말미 2자리 빈티지 떼기: "와인명 22 3병" → 22는 빈티지, "와인명 22" → 22는 빈티지
  // 뒤에 수량+단위가 있으면 2자리는 빈티지 확정
  const UNIT = '(?:병|개|본|잔|ea|EA|pcs|PCS|박스|box|BOX|케이스|보틀|바틀|case|CASE|bt|btl|cs|CS)';
  const vintageQtyMatch = raw.match(new RegExp(`^(.+?)\\s+(\\d{2})\\s+(\\d{1,4})\\s*${UNIT}\\s*$`));
  if (vintageQtyMatch) {
    const v = parseInt(vintageQtyMatch[2], 10);
    if (v >= 10 && v <= 30) {
      // 2자리 빈티지 + 수량+단위 패턴 확정
      return parseInt(vintageQtyMatch[3], 10);
    }
  }

  // 말미가 2자리 숫자만인 경우: "와인명 22" → 와인 빈티지일 가능성 높음 (수량이면 보통 단위 붙임)
  const vintageOnlyMatch = raw.match(/^(.+?)\s+(\d{2})\s*$/);
  if (vintageOnlyMatch) {
    const v = parseInt(vintageOnlyMatch[2], 10);
    if (v >= 10 && v <= 30) {
      // 2자리 빈티지로 판단 → 수량 추출 불가 (null)
      yearHint = yearHint ?? `20${vintageOnlyMatch[2]}`;
      raw = vintageOnlyMatch[1].trim();
    }
  }

  // 패턴 1: cs 패턴 — "xxx cs12"
  const csMatch = raw.match(new RegExp(`^.+?\\s*(?:cs|CS)\\s*(\\d+)\\s*$`));
  if (csMatch) return parseInt(csMatch[1], 10);

  // 패턴 2: 끝에 수량 — "xxx 12병", "xxx 12"
  const endMatch = raw.match(new RegExp(`^.+?[\\s]*([0-9]{1,4})\\s*${UNIT}?\\s*$`));
  if (endMatch) {
    const n = parseInt(endMatch[1], 10);
    // 연도면 스킵
    if (n >= 1900 && n <= 2099) return null;
    if (n > 0) return n;
  }

  // 패턴 3: 글라스 코드 + 수량 — "0447/07 12"
  const glassMatch = raw.match(new RegExp(`^\\d{3,4}\\/\\d{1,3}(?:[A-Z][A-Z0-9]*)?\\s+(\\d+)\\s*${UNIT}?\\s*$`, 'i'));
  if (glassMatch) return parseInt(glassMatch[1], 10);

  // 패턴 4: 역순 — "12 xxx"
  const revMatch = raw.match(/^([0-9]{1,4})\s*.+$/);
  if (revMatch) {
    const n = parseInt(revMatch[1], 10);
    if (n >= 1900 && n <= 2099) return null;
    if (n > 0) return n;
  }

  // 수량을 찾을 수 없으면 null (판단 유보)
  return null;
}

/**
 * LLM 파싱 결과의 각 라인에 대해 수량 크로스체크 수행
 * @param orderLines - LLM이 반환한 [{query, quantity, ...}]
 * @returns 각 라인의 크로스체크 결과
 */
export function crossCheckQuantities(
  orderLines: Array<{ query: string; quantity: number }>
): QtyCheckResult[] {
  return orderLines.map(line => {
    const ruleQty = extractQtyFromQuery(line.query);
    const llmQty = line.quantity;

    // 규칙기반으로 수량 추출 불가 → 체크 불가, 패스
    if (ruleQty === null) {
      return { ruleQty: null, llmQty, mismatch: false };
    }

    const mismatch = ruleQty !== llmQty;

    return {
      ruleQty,
      llmQty,
      mismatch,
      ...(mismatch ? {
        warning: `⚠️ 수량 불일치: 원문에서 ${ruleQty}으로 읽히나 파싱 결과는 ${llmQty}. 원문: "${line.query}"`,
      } : {}),
    };
  });
}
