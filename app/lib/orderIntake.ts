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
import type { MgrClient } from "@/app/lib/orderClients";

// 추출(이미지 OCR)은 정확도 우선 → Sonnet (파싱 단계의 Haiku와 분리).
// Haiku는 카톡 스샷에서 글자를 흐리게 읽어("샤를루"→"사롱루") 뒤 매칭이 오매칭됨.
// OCR 오독이 인식률에 직결되므로, 월 ~수천원 차이를 감수하고 Sonnet 유지.
const EXTRACT_MODEL = "claude-sonnet-4-6";

export interface IntakeResult {
  client_hint: string;
  order_text: string;
  found: boolean;
  // 담당자 거래처 목록을 줬을 때 LLM이 직접 고른 거래처(코드 검증 통과분만)
  client_code?: string;
  client_name?: string;
  client_confidence?: number;
}

const SYSTEM_PROMPT = `너는 카카오톡 발주 스크린샷에서 "거래처"와 "발주 내용"을 추출하는 도우미다.

[발신자 구분 — 가장 중요]
- 카카오톡에서 내(영업담당) 메시지는 화면 오른쪽, 노란색 말풍선이다.
- 거래처(고객) 메시지는 화면 왼쪽, 흰색/회색 말풍선이다.
- 발주는 반드시 "거래처(왼쪽 흰색 말풍선)"에서만 추출한다. 내 메시지(오른쪽 노랑)는 절대 발주로 보지 마라.
  예: "발주 감사합니다", "내일 배송 예정입니다" 같은 내 답장은 제외.

[거래처(client_hint)]
- 거래처 = 이 발주를 받을 업장/상호. 아래를 스스로 판단해 하나만 고른다.
- 기본은 화면 상단 채팅방 제목/발신자에서 상호만 뽑는다(사람 이름·직함 제거).
  예: "에피세리 꼴라주 김정훈 소믈리에" → "에피세리 꼴라주"
      "브이오 이정희 지배인님" → "브이오"
- 고객이 본문에서 "다른 곳으로 보내달라"고 분명히 지시한 경우에만 그 상호를 거래처로 쓰고
  채팅방 제목보다 우선한다. (한 담당자가 여러 업장을 관리하기도 한다.)
  예: 제목 "파티나 이성윤 (매쎄)" + 본문 "매쎄로 리델 6잔 발주 부탁" → client_hint "매쎄"
- 매우 중요: 와인/품목 이름을 거래처로 착각하지 마라. 품명의 일부는 거래처가 아니다.
  배송지인지 품명인지 헷갈리면, 추측하지 말고 채팅방 제목의 상호를 쓴다.
  예: "슈발리에 몽라쉐 17빈 1병 부탁해요" → '슈발리에 몽라쉐'는 와인 이름이다.
      거래처는 채팅방 제목의 상호(예: "브이오"). client_hint 를 "슈발리에"로 쓰면 안 된다.
- 날짜·배송수단(내일/택배/퀵 등)도 거래처가 아니다.

[발주 내용(order_text)]
- 거래처의 가장 최근 발주 메시지에서 품목과 수량을 그대로 추출한다.
- 인사/잡담/결제문의/배송확인 등 발주가 아닌 문장은 제외.
- 품목은 원문 그대로 한 줄에 하나씩. 수량 표기(N병/N개/N잔)도 그대로 유지.
- 발주가 여러 말풍선에 나뉘어 있으면 합친다.

[출력]
JSON만 출력. 설명 금지.
{"client_hint":"상호","order_text":"품목 수량\\n품목 수량","found":true}
발주를 못 찾으면 {"client_hint":"","order_text":"","found":false}`;

// 담당자 거래처 후보를 줄 때 추가되는 규칙 — LLM이 코드까지 직접 고른다.
const CLIENT_PICK_RULE = `[거래처 코드 선택 — 후보 목록이 주어졌을 때]
- 아래 [거래처 후보] 목록은 "이 담당자의 거래처"다. 스크린샷의 거래처를 이 목록에서 골라 client_code를 출력한다.
- 채팅방 제목/상호/별칭(괄호 안)을 종합해 가장 일치하는 한 곳을 고른다. OCR 오독·약어·지점명·존칭을 감안한다.
- 목록에 확실히 없으면 client_code는 "" (빈 문자열)로 두고 client_hint만 채운다. 억지로 고르지 마라.
- client_confidence: 그 거래처라고 확신하는 정도 0~1.
- 반드시 목록에 실제로 있는 코드만 출력한다(없는 코드 창작 금지).
출력 JSON에 client_code, client_confidence 를 추가:
{"client_hint":"상호","client_code":"31960","client_confidence":0.95,"order_text":"품목 수량","found":true}`;

function buildCandidateBlock(clients: MgrClient[]): string {
  const lines = clients.map((c) => {
    const al = c.aliases.length ? ` (${c.aliases.join(", ")})` : "";
    return `${c.client_code}\t${c.client_name}${al}`;
  });
  return `[거래처 후보] (code\\t상호(별칭))\n${lines.join("\n")}`;
}

/** base64 이미지에서 거래처+발주 추출. clients를 주면 거래처 코드까지 LLM이 직접 고른다. */
export async function extractOrderFromImage(
  imageData: string,
  mediaType: string,
  clients?: MgrClient[],
): Promise<IntakeResult> {
  const claude = getClaudeClient();
  const hasCandidates = !!clients && clients.length > 0;
  // 후보 목록은 담당자별로 안정적 → ephemeral 캐시(배치/연속 처리 시 재사용).
  const system = hasCandidates
    ? [
        { type: "text" as const, text: `${SYSTEM_PROMPT}\n\n${CLIENT_PICK_RULE}` },
        { type: "text" as const, text: buildCandidateBlock(clients!), cache_control: { type: "ephemeral" as const } },
      ]
    : SYSTEM_PROMPT;

  const response = await claude.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 1024,
    system,
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

  return parseIntakeJson(text, clients);
}

function parseIntakeJson(text: string, clients?: MgrClient[]): IntakeResult {
  const empty: IntakeResult = { client_hint: "", order_text: "", found: false };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return empty;
    const obj = JSON.parse(match[0]);
    const client_hint = String(obj.client_hint || "").trim();
    const order_text = String(obj.order_text || "").trim();
    const result: IntakeResult = {
      client_hint,
      order_text,
      found: Boolean(obj.found) && order_text.length > 0,
    };
    // LLM이 고른 거래처 코드 검증 — 반드시 제공한 후보 목록에 실제로 있는 코드만 채택(환각 차단).
    const pickedCode = String(obj.client_code || "").trim();
    if (pickedCode && clients?.length) {
      const hit = clients.find((c) => c.client_code === pickedCode);
      if (hit) {
        result.client_code = hit.client_code;
        result.client_name = hit.client_name;
        const conf = Number(obj.client_confidence);
        result.client_confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : undefined;
      }
    }
    return result;
  } catch {
    return empty;
  }
}
