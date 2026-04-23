/* ================= Glass 코드 추출 / 비교 ================= */

// RD 0447/07 → 0447/07, RD 4900/28JG → 4900/28JG, 등
// (?:[A-Z][A-Z0-9]*)?: 알파벳으로 시작하는 영숫자 혼합 접미사 지원
export function extractRDCode(itemName: string): string | null {
  const m = String(itemName || "").match(/RD\s+(\d{4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
  return m ? m[1] : null;
}

// Glass 코드 정규화: 330/07 → 0330/07 (선행 0 보정)
export function normalizeGlassCode(code: string): string {
  if (!code) return code;
  const parts = code.split('/');
  if (parts.length === 2) {
    let prefix = parts[0];
    if (/^\d{3}$/.test(prefix)) prefix = '0' + prefix;
    return `${prefix}/${parts[1]}`;
  }
  return code;
}

// 코드 비교 (0425/0 == 0425/00, 330/07 == 0330/07)
export function codesMatch(input: string, dbCode: string): boolean {
  if (!input || !dbCode) return false;

  const a = normalizeGlassCode(input).toUpperCase();
  const b = normalizeGlassCode(dbCode).toUpperCase();
  if (a === b) return true;

  const [aPrefix, aSuffix] = a.split('/');
  const [bPrefix, bSuffix] = b.split('/');
  if (!aPrefix || !bPrefix || !aSuffix || !bSuffix) return false;
  if (aPrefix !== bPrefix) return false;

  // 접미사를 "선행 숫자" + "알파벳으로 시작하는 혼합 접미사"로 분리
  const splitSuffix = (s: string) => {
    const m = s.match(/^(\d+)((?:[A-Z][A-Z0-9]*)?)$/i);
    if (!m) return { num: NaN, tail: s };
    return { num: parseInt(m[1], 10), tail: m[2].toUpperCase() };
  };
  const aP = splitSuffix(aSuffix);
  const bP = splitSuffix(bSuffix);

  return aP.num === bP.num && aP.tail === bP.tail;
}
