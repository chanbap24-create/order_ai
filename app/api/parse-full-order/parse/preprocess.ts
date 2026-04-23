import { expandFromDict } from "@/app/lib/llmReranker";

/**
 * 번역 전 약어 사전 확장: 메시지 내 와인 약어를 한국어로 미리 확장
 * → 한국어 비율 높아져서 불필요한 GPT 번역 방지 (at, bs 등 브랜드코드 보호)
 * 예: "at rdm 6" → "at 로쏘 디 몬탈치노 6" (rdm 만 확장, at 는 유지)
 */
export function preExpandAbbreviationsInMessage(text: string): string {
  return text.replace(/\S+/g, (token) => {
    // 숫자/한글만으로 된 토큰은 스킵
    if (/^\d+$/.test(token) || /^[가-힣]+$/.test(token)) return token;
    // 후행 구두점 분리
    const match = token.match(/^(.+?)([.,;:!?병]+)?$/);
    if (!match) return token;
    const core = match[1];
    const suffix = match[2] || '';
    const result = expandFromDict(core);
    if (result) return result.wineName + suffix;
    return token;
  });
}

/* -------------------- preprocess -------------------- */
// ✅ 글자/숫자 붙어쓴 케이스 분리 + 문장형 주문 정리
export function preprocessMessage(text: string) {
  let s = String(text || "");

  // 통일
  s = s.replace(/\r/g, "\n");

  // 인사말/군더더기 제거
  s = s.replace(/안녕하세요\.?|안녕하십니까\.?/g, " ");
  s = s.replace(
    /(부탁드려요|부탁드립니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다)\.?/g,
    " ",
  );
  s = s.replace(/(감사합니다|고맙습니다|고맙습니다요|감사해요)\.?/g, " ");
  s = s.replace(/(입니다|요)\.?/g, " ");

  // 슬래시/구분자: 한 줄 여러 품목을 줄로 쪼개기
  s = s.replace(/\s*\/\s*/g, "\n");
  // 쉼표 처리: 영문명 포함 시 쉼표 유지, 아니면 줄바꿈
  const lines = s.split('\n');
  s = lines.map(line => {
    const hasEnglishWords = (line.match(/[A-Za-z]{3,}/g) || []).length >= 2;
    const hasComma = line.includes(',');
    if (hasEnglishWords && hasComma) return line;
    return line.replace(/\s*,\s*/g, "\n");
  }).join('\n');

  // 주문 가능 문구/요청문 제거 (숫자 뒤에 붙어서 수량 인식 방해)
  s = s.replace(/(발주\s*가능할까요|가능할까요|가능한가요|발주\s*가능)\??/g, " ");

  // 문장부호 -> 줄바꿈
  s = s.replace(/(?<!\d)\.(?!\d)|[!?]/g, "\n");

  // "샤도3", "부르고뉴샤도6" 같은 케이스 처리 (프랑스어 서수 "1er", "2eme" 제외)
  s = s.replace(/([가-힣A-Za-z])(\d+)(?!(er|eme|ième)\b)/gi, "$1 $2");
  s = s.replace(/(\d+)(?<!(1|2|3))([가-힣A-Za-z])/g, "$1 $2");

  // 한글-영문 사이 공백 추가 (알테시노bdm → 알테시노 bdm)
  s = s.replace(/([가-힣])([a-z])/gi, "$1 $2");
  s = s.replace(/([a-z])([가-힣])/gi, "$1 $2");

  // 남는 꼬리 표현 제거
  s = s.replace(/(할까요|할까|될까요|될까|가능할까요|가능할까)\b/g, " ");

  // 라인별로 "숫자(수량) 뒤"에 붙은 텍스트를 잘라내기
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
