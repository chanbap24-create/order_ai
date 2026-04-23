/**
 * Glass 전용 preprocess.
 * 와인 order와 달리 RD코드/숫자 슬래시 분리가 핵심.
 */
export function preprocessGlassMessage(text: string) {
  let s = String(text || "");

  s = s.replace(/\r/g, "\n");

  // 인사말/공손어 제거
  s = s.replace(/안녕하세요\.?|안녕하십니까\.?/g, " ");
  s = s.replace(
    /(부탁드려요|부탁드립니다|부탁드리겠습니다|드리겠습니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다|발주\s*요청|발주\s*부탁)\.?/g,
    " ",
  );
  s = s.replace(/(감사합니다|고맙습니다)\.?/g, " ");

  // ", 0330/07" / ", 산타루치아" 같은 연결 → 줄바꿈
  s = s.replace(/,\s*(?=\d{3,4}\/)/g, "\n");
  s = s.replace(/,\s*(?=[가-힣]{2})/g, "\n");

  // 문장부호 → 줄바꿈
  s = s.replace(/(?<!\d)\.(?!\d)|[!?]/g, "\n");

  // 공백 정리
  s = s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return s.trim();
}
