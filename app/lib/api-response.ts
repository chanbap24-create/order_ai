import { NextResponse } from "next/server";

/**
 * 한글이 포함된 JSON을 올바르게 반환하는 헬퍼 함수
 * NextResponse.json()은 기본적으로 한글을 ASCII 이스케이프(\uXXXX)하므로
 * 명시적으로 Content-Type과 charset을 설정합니다.
 */
export function jsonResponse<T = any>(
  data: T,
  options: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, headers = {} } = options;

  const jsonString = JSON.stringify(data, null, 2);

  return new Response(jsonString, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

/**
 * 에러 응답을 반환하는 헬퍼 함수
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: any
): Response {
  return jsonResponse(
    {
      ok: false,
      error: message,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * 성공 응답을 반환하는 헬퍼 함수
 */
export function successResponse<T = any>(data: T, status: number = 200): Response {
  return jsonResponse(
    {
      ok: true,
      data,
    },
    { status }
  );
}
