/**
 * 글자/숫자 붙어쓴 케이스 분리 + 문장형 주문 정리.
 * parse-order-v2 전용 (parse-full-order와 약간 다름).
 */
export function preprocessMessage(text: string) {
  let s = String(text || "");

  // 통일
  s = s.replace(/\r/g, "\n");

  // 인사말/군더더기 제거
  s = s.replace(/안녕하세요\.?|안녕하십니까\.?/g, " ");
  s = s.replace(/(부탁드려요|부탁드립니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다)\.?/g, " ");
  s = s.replace(/(감사합니다|고맙습니다|고맙습니다요|감사해요)\.?/g, " ");
  s = s.replace(/(입니다|요)\.?/g, " ");

  // 슬래시/구분자: 한 줄 여러 품목 → 줄바꿈
  s = s.replace(/\s*\/\s*/g, "\n");

  // 쉼표: 영문명 포함 라인은 유지, 아니면 줄바꿈으로
  const lines = s.split('\n');
  s = lines.map((line) => {
    const hasEnglishWords = (line.match(/[A-Za-z]{3,}/g) || []).length >= 2;
    const hasComma = line.includes(',');
    if (hasEnglishWords && hasComma) return line;
    return line.replace(/\s*,\s*/g, "\n");
  }).join('\n');

  // 주문 가능 문구 제거
  s = s.replace(/(발주\s*가능할까요|가능할까요|가능한가요|발주\s*가능)\??/g, " ");

  // 문장부호 → 줄바꿈
  s = s.replace(/(?<!\d)\.(?!\d)|[!?]/g, "\n");

  // "샤도3" 같은 붙어쓴 케이스 분리
  s = s.replace(/([가-힣A-Za-z])(\d+)/g, "$1 $2");
  s = s.replace(/(\d+)([가-힣A-Za-z])/g, "$1 $2");

  // 남는 꼬리 표현 제거
  s = s.replace(/(할까요|할까|될까요|될까|가능할까요|가능할까)\b/g, " ");

  // 라인별로 "숫자(수량) 뒤"에 붙은 텍스트 잘라내기
  s = s
    .split("\n")
    .map((line) => {
      const l = line.trim();
      if (!l) return l;
      const m = l.match(/^(.*)\b(\d{1,4})\s*(병|박스|cs|box|bt|btl)?\s*$/i);
      if (!m) return l;
      const name = (m[1] || "").trim();
      const qty = (m[2] || "").trim();
      const unit = (m[3] || "").trim();
      return [name, qty, unit].filter(Boolean).join(" ").trim();
    })
    .join("\n");

  // 공백 정리
  s = s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return s.trim();
}
