// app/lib/parseItems.ts
console.log("[USING parseItems.ts]", __filename);

// message에서 "품목명 + 수량"만 뽑아냄
// - 줄바꿈/슬래시(/)/쉼표 기준으로 쪼갬
// - "샤를루 6병", "말벡2", "램본cs1", "진판델  1" 같은 케이스 처리
// - "2023 로버트 ... 1병" 같은 빈티지 선두(연도) 케이스 처리: 연도를 수량으로 잡지 않게!
export function parseItemsFromMessage(message: string) {
  const text = String(message || "").replace(/\r/g, "");

  // ✅ 0) 붙여쓴 케이스 1차 분리
  // - "위게뜨블랑2" -> "위게뜨블랑 2"
  // - "2023로버트" -> "2023 로버트"
  const text2 = text
    .replace(
      /([가-힣A-Za-z])(\d{1,4})(?=(?:병|개|본|ea|EA|pcs|PCS|박스|box|BOX|케이스|보틀|바틀|case|CASE|bt|btl)?\b)/g,
      "$1 $2"
    )
    .replace(/(19\d{2}|20\d{2})(?=[가-힣A-Za-z])/g, "$1 ");

  // 1) 기본 분해
  // ✅ 쉼표 처리: 영문 생산자명 패턴이 있으면 쉼표를 무시
  // 예: "Christophe Pitois, Grand Cru..." → 쉼표로 분리 안 함
  // 예: "샤또마르고, 루이로드레" → 쉼표로 분리함
  const lines = text2.split(/\n/);
  const parts0: string[] = [];
  
  for (const line of lines) {
    // 영문 생산자명 패턴 감지: "단어, 대문자로 시작하는 단어" 또는 "단어 단어, 대문자"
    // 예: "Christophe Pitois, Grand Cru" → 쉼표 유지
    // 예: "샤또마르고, 루이로드레" → 쉼표로 분리
    const hasProducerPattern = /[A-Z][a-z]+\s+[A-Z][a-z]+,\s+[A-Z]/.test(line) || 
                               /[A-Z][a-z]+,\s+[A-Z]/.test(line);
    
    console.log(`[DEBUG-PARSE] Line: "${line}" | hasProducerPattern: ${hasProducerPattern}`);
    
    if (hasProducerPattern) {
      // 영문 생산자명이 있으면 쉼표 무시하고 슬래시/세미콜론만 분리
      const subParts = line.split(/\/|；|;/).map(s => s.trim()).filter(Boolean);
      console.log(`[DEBUG-PARSE] Keeping comma, subParts:`, subParts);
      parts0.push(...subParts);
    } else {
      // 일반 케이스: 쉼표도 분리
      const subParts = line.split(/\/|,|；|;/).map(s => s.trim()).filter(Boolean);
      console.log(`[DEBUG-PARSE] Splitting comma, subParts:`, subParts);
      parts0.push(...subParts);
    }
  }

  // 2) ✅ 연도 토큰이 전처리로 찢어진 케이스 병합
  // - "2024" + "팝콘 소비뇽블랑 8병" -> "2024 팝콘 소비뇽블랑 8병"
  // - "2 0 2 4 ..." -> "2024 ..."
  const parts: string[] = [];
  for (let i = 0; i < parts0.length; i++) {
    const cur = parts0[i];
    const next = parts0[i + 1];

    // (a) cur이 "2024" 같은 연도 단독인 경우: 다음 줄과 합치기
    if (/^(19\d{2}|20\d{2})$/.test(cur) && next) {
      parts.push(`${cur} ${next}`.trim());
      i += 1;
      continue;
    }

    // (b) "2 0 2 4 로버트..." -> "2024 로버트..."
    const spacedYear = cur.match(/^((?:\d\s*){4})\s+(.+)$/);
    if (spacedYear) {
      const y = spacedYear[1].replace(/\s+/g, "");
      if (/^(19\d{2}|20\d{2})$/.test(y)) {
        parts.push(`${y} ${spacedYear[2]}`.trim());
        continue;
      }
    }

    parts.push(cur);
  }

  const out: Array<{ raw: string; name: string; qty: number }> = [];

  for (const raw0 of parts) {
    let raw = raw0.replace(/\s+/g, " ").trim();

    // ✅ 꼬리말/군더더기 제거 (요청드립니다 때문에 끝-수량 매칭이 깨지지 않도록)
    raw = stripTailPhrases(raw);

    // ✅ 숫자(수량) 자체가 없는 배송/메모 라인 스킵
    // 예: "마포점으로", "내일 배송", "퀵으로 부탁", "주소 ...", 등
    if (!/\d/.test(raw)) {
      if (
        /(점으로|로\s*$|배송|출고|퀵|택배|픽업|방문|오늘|내일|모레|오전|오후|저녁|주소|연락처)/.test(
          raw
        )
      ) {
        continue;
      }
    }

    // 인사/마무리 같은 줄 스킵
    if (/^(안녕|감사|부탁|수고|확인|과장님|대표님)/.test(raw)) continue;

    // =========================================================
    // ✅ [빈티지 FIX] 연도는 "수량"이 아니라 "빈티지 힌트"로만 취급
    // - 앞에 붙은 연도: "2024 팝콘 ... 8병"
    // - 뒤에 붙은 연도: "팝콘 ... 8병 2024" / "팝콘 ... 8 2024"
    // - 붙여쓴 연도: "2024팝콘 ... 8병"
    // =========================================================
    let yearHint: string | null = null;

    // "2024팝콘" 같은 케이스 한 번 더 분리(안전망)
    raw = raw.replace(/^(19\d{2}|20\d{2})(?=[가-힣A-Za-z])/g, "$1 ");

    // (1) 선두 연도 떼기
    const yFront = raw.match(/^(19\d{2}|20\d{2})\s+(.+)$/);
    if (yFront) {
      yearHint = yFront[1];
      raw = yFront[2].trim();
    }

    // (2) 말미 연도 떼기 (수량 뒤에 연도가 붙는 케이스를 방지)
    const yBack = raw.match(/^(.+?)\s+(19\d{2}|20\d{2})\s*$/);
    if (yBack) {
      yearHint = yearHint ?? yBack[2];
      raw = yBack[1].trim();
    }

    // ✅ 연도/꼬리말 제거 후 한 번 더
    raw = stripTailPhrases(raw);

    // ✅ 여기서부터 매칭용 변수 (현재 파일에서 이게 없어서 오류났음)
    let m: RegExpMatchArray | null = null;

    // =========================================================
    // ✅ 1) "xxx cs1" / "xxx cs 1" / "xxx CS1"
    // =========================================================
    m = raw.match(/^(.+?)\s*(?:cs|CS)\s*(\d+)\s*$/);
    if (m) {
      const baseName = cleanItemName(m[1]);
      const qty = parseInt(m[2], 10);
      const name = cleanItemName(baseName + (yearHint ? ` ${yearHint}` : ""));
      if (name && qty > 0) out.push({ raw: raw0, name, qty });
      continue;
    }

    // =========================================================
    // ✅ 2) "xxx 6병" / "xxx6병" / "xxx 6" / "xxx6"
    // (끝에 수량이 오는 케이스)
    // ★ "그라함 30년 6 요청드립니다"는 stripTailPhrases 후 "그라함 30년 6"이 되어 여기서 잡힘
    // =========================================================
    m = raw.match(
      /^(.+?)[\s]*([0-9]{1,4})\s*(?:병|개|본|ea|EA|pcs|PCS|박스|box|BOX|케이스|보틀|바틀|case|CASE|bt|btl)?\s*$/
    );

    if (m) {
      const baseName = cleanItemName(m[1]);
      const lastNum = parseInt(m[2], 10);

      // ✅ [연도 보호] 맨 끝 숫자가 연도(1900~2099)면 수량으로 확정하지 않는다.
      if (lastNum >= 1900 && lastNum <= 2099) {
        const m2 = raw.match(
          /^(.+?)\s+([0-9]{1,4})\s*(?:병|개|본|ea|EA|pcs|PCS|박스|box|BOX|케이스|보틀|바틀|case|CASE|bt|btl)\s*$/
        );

        if (m2) {
          const qty2 = parseInt(m2[2], 10);
          if (qty2 > 0 && qty2 < 1900) {
            const name2 = cleanItemName(
              m2[1] + (yearHint ? ` ${yearHint}` : "")
            );
            if (name2) out.push({ raw: raw0, name: name2, qty: qty2 });
          }
        }
        continue;
      }

      const name = cleanItemName(baseName + (yearHint ? ` ${yearHint}` : ""));
      if (name && lastNum > 0) out.push({ raw: raw0, name, qty: lastNum });
      continue;
    }

    // =========================================================
    // ✅ 3) "6 샤를루" 역순
    // 단, 앞 숫자가 4자리 연도면 역순 룰 금지
    // =========================================================
    m = raw.match(/^([0-9]{1,4})\s*(.+)$/);
    if (m) {
      const firstNum = m[1];
      if (/^(19\d{2}|20\d{2})$/.test(firstNum)) continue;

      const qty = parseInt(firstNum, 10);
      const baseName = cleanItemName(m[2]);
      const name = cleanItemName(baseName + (yearHint ? ` ${yearHint}` : ""));
      if (name && qty > 0) out.push({ raw: raw0, name, qty });
      continue;
    }
  }

  return mergeSameName(out);
}

/**
 * ✅ 라인 끝/중간에 붙는 “요청드립니다/부탁드립니다/주세요…” 같은 꼬리말 제거
 */
function stripTailPhrases(s: string) {
  let t = String(s || "").replace(/\s+/g, " ").trim();

  // ✅ 한글에서는 \b 경계가 잘 안 먹으니 "공백/끝" 기반으로 제거
  // 앞뒤에 공백/끝/구두점이 와도 잡히도록 처리
  const tail = [
    "발주요청드립니다",
    "발주 요청드립니다",
    "주문요청드립니다",
    "주문 요청드립니다",
    "요청드립니다",
    "부탁드립니다",
    "부탁드려요",
    "부탁해요",
    "요청해요",
    "해주세요",
    "주세요",
  ];

  // 1) tail 문구들을 어떤 위치든 제거 (특히 줄 끝에 붙는 케이스)
  for (const w of tail) {
    // 공백/구두점/끝 처리: "요청드립니다", "요청드립니다.", "요청드립니다!" 등
    const re = new RegExp(`(?:\\s|^)+${escapeRegExp(w)}(?=\\s|$|[.,!~…])`, "g");
    t = t.replace(re, " ");
  }

  // 2) 더 짧은 단어들도 제거
  t = t.replace(/(?:\s|^)+(요청|부탁|드립니다)(?=\s|$|[.,!~…])/g, " ");

  // 3) 공백 정리
  return t.replace(/\s+/g, " ").trim();
}

function escapeRegExp(x: string) {
  return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function cleanItemName(s: string) {
  return String(s || "")
    .replace(/[:\-–—]/g, " ")
    .replace(/\s+/g, " ")
    // ✅ 끝에 남아있는 꼬리말/불필요 문구 제거
    .replace(/\s*(발주|주문|요청드립니다|부탁드립니다|부탁드려요|요청|부탁|드립니다|해주세요|주세요)\s*$/g, "")
    .trim();
}

function mergeSameName(items: Array<{ raw: string; name: string; qty: number }>) {
  const map = new Map<string, { raw: string; name: string; qty: number }>();
  for (const it of items) {
    const key = it.name.toLowerCase();
    const prev = map.get(key);
    if (!prev) map.set(key, { ...it });
    else prev.qty += it.qty;
  }
  return Array.from(map.values());
}
