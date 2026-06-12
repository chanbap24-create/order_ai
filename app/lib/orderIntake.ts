// 카톡 스크린샷 → { 거래처힌트, 발주텍스트 } 추출 (비전).
//
// 발주 자동화 1단계: 거래처/발주를 따로 입력하던 것을, 카톡 스샷 한 장에서
// 자동 추출해 기존 파싱 파이프라인으로 넘긴다.
//
// 핵심 규칙(프롬프트):
//  - 카톡 말풍선 방향으로 발신자 구분: 내 메시지(오른쪽/노랑)는 발주가 아니다.
//    거래처(왼쪽/흰색) 말풍선에서만 발주를 뽑는다.
//  - 방 제목에서 상호(거래처)만 추출 (사람이름/직함 제거).
//  - 잡담/인사/결제문의 등은 제외, 품목+수량 형태의 가장 최근 발주만.

import { getClaudeClient } from "@/app/lib/claudeClient";

// 추출(이미지 OCR)은 정확도 우선 → Sonnet (파싱 단계의 Haiku와 분리).
// Haiku는 카톡 스샷에서 글자를 흐리게 읽어("샤를루"→"사롱루") 뒤 매칭이 오매칭됨.
// OCR 오독이 인식률에 직결되므로, 월 ~수천원 차이를 감수하고 Sonnet 유지.
const EXTRACT_MODEL = "claude-sonnet-4-6";

export interface IntakeResult {
  client_hint: string;
  order_text: string;
  found: boolean;
}

const SYSTEM_PROMPT = `너는 카카오톡 발주 스크린샷에서 "거래처"와 "발주 내용"을 추출하는 도우미다.

[발신자 구분 — 가장 중요]
- 카카오톡에서 내(영업담당) 메시지는 화면 오른쪽, 노란색 말풍선이다.
- 거래처(고객) 메시지는 화면 왼쪽, 흰색/회색 말풍선이다.
- 발주는 반드시 "거래처(왼쪽 흰색 말풍선)"에서만 추출한다. 내 메시지(오른쪽 노랑)는 절대 발주로 보지 마라.
  예: "발주 감사합니다", "내일 배송 예정입니다" 같은 내 답장은 제외.

[거래처(client_hint)]
- 화면 상단 채팅방 제목에서 상호(가게/업장 이름)만 뽑는다.
- 사람 이름·직함(소믈리에/과장/대표/사장님/실장 등)은 제거.
  예: "에피세리 꼴라주 김정훈 소믈리에" → "에피세리 꼴라주"

[발주 내용(order_text)]
- 거래처의 가장 최근 발주 메시지에서 품목과 수량을 그대로 추출한다.
- 인사/잡담/결제문의/배송확인 등 발주가 아닌 문장은 제외.
- 품목은 원문 그대로 한 줄에 하나씩. 수량 표기(N병/N개/N잔)도 그대로 유지.
- 발주가 여러 말풍선에 나뉘어 있으면 합친다.

[출력]
JSON만 출력. 설명 금지.
{"client_hint":"상호","order_text":"품목 수량\\n품목 수량","found":true}
발주를 못 찾으면 {"client_hint":"","order_text":"","found":false}`;

/** base64 이미지에서 거래처+발주 추출 */
export async function extractOrderFromImage(
  imageData: string,
  mediaType: string,
): Promise<IntakeResult> {
  const claude = getClaudeClient();
  const response = await claude.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              // SDK 타입: 허용된 media_type 유니온. 런타임 검증은 route에서.
              media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
              data: imageData,
            },
          },
          {
            type: "text",
            text: "이 카카오톡 발주 스크린샷에서 거래처와 발주 내용을 추출해줘.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  return parseIntakeJson(text);
}

function parseIntakeJson(text: string): IntakeResult {
  const empty: IntakeResult = { client_hint: "", order_text: "", found: false };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return empty;
    const obj = JSON.parse(match[0]);
    const client_hint = String(obj.client_hint || "").trim();
    const order_text = String(obj.order_text || "").trim();
    return {
      client_hint,
      order_text,
      found: Boolean(obj.found) && order_text.length > 0,
    };
  } catch {
    return empty;
  }
}
