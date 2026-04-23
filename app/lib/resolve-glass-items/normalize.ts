/* ================= Glass 공통 정규화 ================= */

export function normLocal(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,]/g, " ");
}

export function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

export function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  // 단위 포함 수량 제거 (Korean \b 호환: \b 대신 경계 없이 매칭)
  s = s.replace(/(\d+)\s*(병|박스|cs|box|bt|btl|개|잔)/gi, "").trim();
  // 슬래시/대시 뒤 숫자는 코드 일부이므로 보호 (0330/07의 07을 지우면 안됨)
  s = s.replace(/(?<![\/\-])\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function norm(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

export function scoreItem(q: string, name: string) {
  const a = norm(q);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.9;

  // Bigram (Dice coefficient) 유사도
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substring(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2);
    const cnt = bigramsA.get(bg) || 0;
    if (cnt > 0) {
      bigramsA.set(bg, cnt - 1);
      intersection++;
    }
  }
  const dice = (2.0 * intersection) / (a.length - 1 + b.length - 1);
  return Math.min(0.89, dice);
}
