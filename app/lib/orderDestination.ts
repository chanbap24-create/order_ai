// 발주 본문에서 "명시적 배송지(거래처)" 추출.
//
// 배경: 한 담당자가 여러 거래처를 관리할 때, 채팅방 제목/발신자명은 A 인데
// 본문에 "매쎄로 발주", "OO으로 보내주세요"처럼 보낼 곳을 따로 적는 경우가 있다.
// 이때는 본문에 적힌 상호를 거래처로 우선해야 한다.
//
// 반환: 배송지 상호(예: "매쎄") | null
// 주의: 여기서는 "후보 상호 문자열"만 뽑는다. 실제 거래처 매칭/검증은 호출부의
//       resolveClient 가 거래처 DB로 수행하므로, 약간의 오탐은 "미해결"로 떨어질 뿐
//       강제 오매칭되지는 않는다.

// 발주/배송 맥락에서만 추출 (일반 문장 오탐 방지)
const ORDER_VERB = /(발주|보내|배송|주문|넣어|부탁|주세요)/;

// "~로/~으로"로 끝나지만 거래처가 아닌 단어(날짜·배송수단·지시어 등)
const NON_CLIENT_DEST = new Set([
  "내일", "오늘", "모레", "글피", "금일", "명일", "다음주", "이번주", "담주", "주말",
  "택배", "퀵", "퀵서비스", "화물", "직접", "방문", "수기", "참고", "아래", "위",
  "그쪽", "이쪽", "저쪽", "여기", "거기", "어디", "택배사", "당일",
]);

// 상호 앞에 붙는 인사·호칭·동사 등(2어절 상호 합칠 때 앞 토큰에서 떼어냄)
const FILLER = new Set([
  "안녕하세요", "안녕", "반갑습니다", "수고", "수고하세요", "고맙습니다", "감사", "감사합니다",
  "사장님", "대표님", "실장님", "과장님", "부장님", "점장님", "소믈리에", "담당자", "담당",
  "발주", "주문", "배송", "오늘", "내일",
]);

const W = "[가-힣A-Za-z][가-힣A-Za-z0-9()&·\\-]{0,18}?";
// 선택적 앞 토큰 + 상호 + (으)로 (뒤에 공백/끝/문장부호). 2어절 상호 대응.
const DEST_RE = new RegExp(`(${W})(?:\\s+(${W}))?(?:으로|로)(?=\\s|$|[,.!?~…])`, "g");

/** 본문에서 명시적 배송지 상호를 추출. 없으면 null. */
export function extractDeliveryDestination(text: string | null | undefined): string | null {
  const msg = String(text ?? "").replace(/\r/g, "");
  if (!msg.trim() || !ORDER_VERB.test(msg)) return null;

  for (const m of msg.matchAll(DEST_RE)) {
    const lead = m[1];
    const head = m[2]; // (으)로 바로 앞 토큰. 없으면 lead 가 곧 상호.
    const near = head || lead; // 상호의 핵심 토큰
    if (!near || near.length < 2) continue; // 너무 짧음
    if (/\d/.test(near)) continue; // 숫자 포함 → 품목/수량으로 간주
    if (NON_CLIENT_DEST.has(near)) continue; // 날짜/배송수단 등
    // 2어절 상호: 앞 토큰이 인사/호칭/동사가 아니면 합친다("에피세리 꼴라주").
    if (head && lead && !FILLER.has(lead) && !/\d/.test(lead)) return `${lead} ${head}`;
    return near;
  }
  return null;
}
