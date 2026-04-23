/**
 * Glass 품목 단위 결정 로직
 *
 * 규칙 (parse-glass-order API와 동일):
 * - "개" 단위: 부자재/악세서리 키워드 (디캔터, 박스, 쇼핑백 등)
 * - "잔" 단위: RD 와인잔 코드, 레스토랑 시리즈, 숫자 전용 코드
 * - 기본값: "개"
 */

/** "개" 단위로 고정되는 키워드 (부자재/악세서리) */
export const OPEN_UNIT_KEYWORDS =
  /디캔터|박스|쇼핑백|클리너|캐링백|세트|밸류팩|폴리싱|클로스|린넨|보틀\s*클리너/i;

/** "RD 0416/2" 같은 RD 와인잔 코드 패턴 */
const RD_CODE_PATTERN = /RD\s+(\d{4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i;

/** "레스토랑" 시리즈 키워드 */
const RESTAURANT_PATTERN = /레스토랑/i;

/** 코드만 입력된 경우 패턴 (예: 0416/2, 416/2) */
const CODE_ONLY_PATTERN = /^0?\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?$/i;

/** 품목명에서 단위("개" | "잔")를 결정 */
export function getGlassUnit(itemName: string): "개" | "잔" {
  if (!itemName) return "개";

  if (OPEN_UNIT_KEYWORDS.test(itemName)) return "개";
  if (RD_CODE_PATTERN.test(itemName)) return "잔";
  if (RESTAURANT_PATTERN.test(itemName)) return "잔";
  if (CODE_ONLY_PATTERN.test(itemName)) return "잔";

  return "개";
}

/** 직원 메시지 라인 매칭에 쓰이는 가능한 단위 목록 */
export const POSSIBLE_UNITS = ["병", "잔", "개"] as const;
export type GlassUnit = (typeof POSSIBLE_UNITS)[number];
