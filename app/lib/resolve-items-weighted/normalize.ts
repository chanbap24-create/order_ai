/* ================= 정규화 함수 ================= */

export function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    // ✅ 곡선 따옴표 통일
    .replace(/["“”]/g, '"')
    .replace(/['‘’]/g, "'")
    // ✅ 악센트 제거
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

export function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/* ================= 품목명 정규화 ================= */

export function normalizeItemName(s: string) {
  let t = String(s || "").toLowerCase();
  t = t.replace(/\s+/g, " ").trim();

  // Sauvignon Blanc
  t = t.replace(/\bsauvignon\s+blanc\b/gi, "소비뇽블랑");
  t = t.replace(/\bsauv\s*blanc\b/gi, "소비뇽블랑");
  t = t.replace(/\bs\.?\s*b\.?\b/gi, "소비뇽블랑");
  t = t.replace(/\bsauvignon\b/gi, "소비뇽");

  // Cabernet Sauvignon
  t = t.replace(/\bcabernet\s+sauvignon\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcab\s*sauv\b/gi, "카베르네소비뇽");
  t = t.replace(/\bc\/s\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcabernet\b/gi, "카베르네");
  t = t.replace(/\bcab\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcs\b/gi, "카베르네소비뇽");
  t = t.replace(/\bcs(?=\s*\d)/gi, "카베르네소비뇽");

  // Chardonnay
  t = t.replace(/\bchardonnay\b/gi, "샤르도네");
  t = t.replace(/\bchard\b/gi, "샤르도네");
  t = t.replace(/샤도네이|샤도네|샤도/g, "샤르도네");

  // Pinot Noir
  t = t.replace(/\bpinot\s+noir\b/gi, "피노누아");
  t = t.replace(/\bp\.?\s*n\.?\b/gi, "피노누아");

  // Merlot
  t = t.replace(/\bmerlot\b/gi, "메를로");

  // Riesling
  t = t.replace(/\briesling\b/gi, "리슬링");

  // 일반 와인 용어
  t = t.replace(/\bblanc\b/gi, "블랑");
  t = t.replace(/\bred\b/gi, "레드");
  t = t.replace(/\bwhite\b/gi, "화이트");
  t = t.replace(/\brose\b/gi, "로제");

  // Chablis
  t = t.replace(/\bchablis\b/gi, "샤블리");

  // Louis Michel (생산자)
  t = t.replace(/\blouis\s+michel\b/gi, "루이미셸");
  t = t.replace(/\blouis\b/gi, "루이");
  t = t.replace(/\bmichel\b/gi, "미셸");
  t = t.replace(/미쉘/g, "미셸"); // 오타 수정: 미쉘 → 미셸

  // Montee de tonnerre (프리미엄 크뤼)
  t = t.replace(/\bmontée\s+de\s+tonnerre\b/gi, "몬테드토네흐");
  t = t.replace(/\bmontee\s+de\s+tonnerre\b/gi, "몬테드토네흐");
  t = t.replace(/\bmontée\b/gi, "몬테");
  t = t.replace(/\bmontee\b/gi, "몬테");
  t = t.replace(/\btonnerre\b/gi, "토네흐");

  return t;
}

export function norm(s: string) {
  return normalizeItemName(s)
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}
