// 입력 검증 시스템 (Zod 기반)

import { z } from "zod";
import { BadRequestError } from "./errors";

// ==================== 공통 스키마 ====================

export const parseFullOrderSchema = z.object({
  message: z.string().min(1, "메시지가 필요합니다"),
  force_resolve: z.boolean().optional().default(false),
});

export const resolveClientSchema = z.object({
  message: z.string().optional().default(""),
  client_hint: z.string().optional().default(""),
  force_resolve: z.boolean().optional().default(false),
});

export const parseOrderSchema = z.object({
  clientCode: z.string().min(1, "clientCode가 필요합니다"),
  orderText: z.string().min(1, "orderText가 필요합니다"),
});

export const parseSchema = z.object({
  text: z.string().min(1, "text가 필요합니다"),
});

export const learnItemAliasSchema = z.object({
  alias: z.string().min(1, "alias가 필요합니다"),
  canonical: z.string().min(1, "canonical이 필요합니다"),
});

export const confirmItemAliasSchema = z.object({
  itemIndex: z.number().int().min(0),
  selectedItemNo: z.string().min(1),
  selectedItemName: z.string().min(1),
  clientCode: z.string().min(1),
  rawText: z.string(),
});

export const deleteItemAliasSchema = z.object({
  alias: z.string().min(1, "alias가 필요합니다"),
});

export const learnSearchSchema = z.object({
  query: z.string().min(1, "query가 필요합니다"),
  selectedItemNo: z.string().min(1, "selectedItemNo가 필요합니다"),
  selectedItemName: z.string().min(1, "selectedItemName이 필요합니다"),
});

// ==================== 검증 헬퍼 ====================

/**
 * 요청 본문을 스키마로 검증하고 타입 안전한 데이터 반환
 * @throws BadRequestError 검증 실패 시
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = (error as any).errors?.map((e: any) => `${e.path?.join(".") || ''}: ${e.message || ''}`).join(", ") || error.message;
      throw new BadRequestError(`Validation failed: ${messages}`, "VALIDATION_ERROR");
    }
    throw error;
  }
}

/**
 * 요청 본문을 안전하게 파싱 (에러 발생 시 빈 객체 반환)
 */
export async function safeParseBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
