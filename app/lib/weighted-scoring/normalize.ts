export function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  s = s.replace(/(\d+)\s*(병|박스|cs|box|bt|btl|개|잔)/gi, "").trim();
  // 슬래시/대시 뒤 숫자는 코드 일부이므로 보호 (0330/07의 07을 지우면 안됨)
  s = s.replace(/(?<![\/\-])\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

export function isSpecificAlias(alias: string) {
  const a = stripQtyAndUnit(alias);
  const tokens = a.split(" ").filter(Boolean);
  const tightLen = normTight(a).length;

  const koreanChars = (a.match(/[가-힣]/g) || []).length;
  const totalChars = a.length || 1;
  const isKorean = koreanChars / totalChars > 0.5;

  if (isKorean) {
    // 한글 기준: 2토큰 이상 OR 6글자 이상
    return tokens.length >= 2 || tightLen >= 6;
  }
  // 영문 기준: 3토큰 이상 OR 12글자 이상
  return tokens.length >= 3 || tightLen >= 12;
}
