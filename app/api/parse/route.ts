import OpenAI from "openai";
import { NextResponse } from "next/server";
import { handleApiError, BadRequestError, InternalServerError } from "@/app/lib/errors";
import { validateRequest, safeParseBody, parseSchema } from "@/app/lib/validation";
import { logger } from "@/app/lib/logger";
import { config } from "@/app/lib/config";
import { env } from "@/app/lib/env";
import type { ParseRequest, ParseResponse, ParsedItem } from "@/app/types/api";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const MAX_ITEMS = config.parsing.maxItems;

/**
 * 모델은 "구조화된 주문 정보(items)"만 뽑는다.
 * 최종 문구(staffMessage/clientMessage)는 서버에서 100% 고정 포맷으로 조립한다.
 */

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "ParsedOrder",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["clientName", "items"],
      properties: {
        clientName: { type: "string" },
        items: {
          type: "array",
          maxItems: MAX_ITEMS,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["code", "name", "qty", "price"],
            properties: {
              code: { type: "string" }, // 품목코드 (모르면 "확인필요")
              name: { type: "string" }, // 품목명 (원문 기준)
              qty: { type: "integer", minimum: 0 }, // 수량
              price: { type: ["integer", "null"], minimum: 0 }, // 가격 (모르면 null)
            },
          },
        },
      },
    },
  },
} as const;

function getKSTDateString(d: Date) {
  // YYYY-MM-DD (Asia/Seoul)
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function formatPrice(p: number | null) {
  return p === null ? "가격미정" : p.toLocaleString("ko-KR");
}

function buildDeliveryLine(orderDateYYYYMMDD: string) {
  // 요청하신 고정 문구 그대로
  return `${orderDateYYYYMMDD}-오후4시30분 이전이면 익일, 이후라면 익익일.`;
}

function buildStaffMessage(
  clientName: string,
  deliveryLine: string,
  items: Array<{ code: string; name: string; qty: number; price: number | null }>
) {
  const safeItems = items.slice(0, MAX_ITEMS);

  const lines = safeItems.map((it, idx) => {
    return `${idx + 1}.[${it.code}] [${it.name}] [${it.qty}] [${formatPrice(it.price)}]`;
  });

  return [
    `[${clientName}]`,
    deliveryLine,
    ...lines, // 1~N까지 전부 출력
    "",
    "발주 부탁드립니다.",
    "감사합니다.",
  ].join("\n");
}

function buildClientMessage(clientName: string, deliveryLine: string) {
  return [
    `[${clientName}]`,
    "",
    "발주 감사합니다.",
    deliveryLine,
    "배송 예정입니다~!",
  ].join("\n");
}

export async function POST(req: Request): Promise<NextResponse<ParseResponse>> {
  try {
    const rawBody = await safeParseBody(req);
    const { text } = validateRequest(parseSchema, rawBody) as ParseRequest;

    const completion = await openai.responses.create({
      model: config.openai.model,
      input: [
        {
          role: "system",
          content: [
            "You extract a Korean wine order into structured JSON.",
            "Return ONLY valid JSON that matches the schema.",
            "",
            "Rules:",
            `- items: list up to ${MAX_ITEMS} items max.`,
            "- Each item must include: code, name, qty, price.",
            "- If any field is unknown:",
            "  - code: use '확인필요' (string) if you cannot infer.",
            "  - price: use null if unknown.",
            "- qty must be an integer (if unclear, set 0).",
            "- clientName: if not explicitly present, infer from text; otherwise use '거래처확인필요'.",
            "",
            "Important:",
            "- Do not add extra fields.",
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
      response_format: responseFormat,
    });

    const jsonText = completion.output_text;

    let parsed: {
      clientName: string;
      items: ParsedItem[];
    };

    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      logger.error("Failed to parse OpenAI response", error, { raw: jsonText });
      throw new InternalServerError("Model returned invalid JSON", "INVALID_JSON_RESPONSE");
    }

    // 배송 문구 생성 (KST 기준 오늘 날짜)
    const todayKST = getKSTDateString(new Date());
    const deliveryLine = buildDeliveryLine(todayKST);

    // 최종 문구 조립 (형식 100% 고정)
    const staffMessage = buildStaffMessage(parsed.clientName, deliveryLine, parsed.items);
    const clientMessage = buildClientMessage(parsed.clientName, deliveryLine);

    const response: ParseResponse = {
      clientName: parsed.clientName,
      deliveryLine,
      items: parsed.items.slice(0, MAX_ITEMS),
      staffMessage,
      clientMessage,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("parse error", error);
    return handleApiError<ParseResponse>(error);
  }
}
