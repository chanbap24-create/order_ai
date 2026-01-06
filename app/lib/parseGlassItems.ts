/* ================= Glass(와인잔) 전용 파싱 ================= */

// ✅ Glass 발주는 특수한 패턴이 많음:
// 1. 코드 우선: "0447/07(레스토랑 뉴월드 피노) : 12잔"
// 2. 품목명만: "리델 퍼포먼스 피노누아 12개"
// 3. 약어: "피노누아 글라스 1박스"

type ParsedGlassItem = {
  raw: string;
  code?: string;  // 품목 코드 (0447/07)
  name: string;   // 품목명
  qty: number;
};

export function parseGlassItemsFromMessage(text: string): ParsedGlassItem[] {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedGlassItem[] = [];

  for (const line of lines) {
    // ✅ 거래처 코드 제외 (숫자만 있는 라인: 12096, 30001 등)
    if (/^\d+$/.test(line)) {
      continue;
    }

    // ✅ 패턴 1: 코드가 앞에 있는 경우
    // "0447/07(레스토랑 뉴월드 피노) : 12잔"
    // "0446/0(레스토랑 까베르네) : 12잔"
    const codePattern = /^(\d{4}\/\d{1,2}[A-Z]?)\s*\(([^)]+)\)\s*[:：]?\s*(\d+)\s*(잔|개|병|박스|box)?/i;
    const m1 = line.match(codePattern);
    
    if (m1) {
      items.push({
        raw: line,
        code: m1[1],
        name: m1[2].trim(),
        qty: Number(m1[3]),
      });
      continue;
    }

    // ✅ 패턴 2: 코드 없이 품목명만
    // "리델 퍼포먼스 피노누아 12개"
    // "피노누아 글라스 1박스"
    const namePattern = /^(.+?)\s+(\d+)\s*(잔|개|병|박스|box|cs)?$/i;
    const m2 = line.match(namePattern);
    
    if (m2) {
      const name = m2[1].trim();
      // 너무 짧은 품목명 제외 (2글자 이하)
      if (name.length <= 2) continue;
      
      items.push({
        raw: line,
        name,
        qty: Number(m2[2]),
      });
      continue;
    }

    // ✅ 패턴 3: 수량이 앞에 있는 경우
    // "12개 리델 퍼포먼스 피노누아"
    const qtyFirstPattern = /^(\d+)\s*(잔|개|병|박스|box|cs)?\s+(.+)$/i;
    const m3 = line.match(qtyFirstPattern);
    
    if (m3) {
      items.push({
        raw: line,
        name: m3[3].trim(),
        qty: Number(m3[1]),
      });
      continue;
    }

    // ✅ 패턴 4: 수량이 없는 경우 (기본 1개)
    // 단, 한글이나 영문이 포함된 경우만 (순수 숫자 제외)
    if (line.length > 2 && /[가-힣A-Za-z]/.test(line)) {
      items.push({
        raw: line,
        name: line.trim(),
        qty: 1,
      });
    }
  }

  return items;
}
