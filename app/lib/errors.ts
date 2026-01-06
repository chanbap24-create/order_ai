// 에러 처리 통일

import { NextResponse } from "next/server";
import { logger } from "./logger";

// 커스텀 에러 클래스
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// HTTP 에러 팩토리 함수들
export class BadRequestError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, code || "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", code?: string) {
    super(message, 401, code || "UNAUTHORIZED");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not found", code?: string) {
    super(message, 404, code || "NOT_FOUND");
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error", code?: string) {
    super(message, 500, code || "INTERNAL_SERVER_ERROR");
  }
}

// 에러를 API 응답으로 변환
export function handleApiError<T = any>(error: unknown): NextResponse<T> {
  // AppError 인스턴스인 경우
  if (error instanceof AppError) {
    logger.error(`API Error [${error.statusCode}]: ${error.message}`, {
      code: error.code,
      stack: isDev ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // 일반 Error 인스턴스인 경우
  if (error instanceof Error) {
    logger.error("Unexpected error", error, {
      message: error.message,
      stack: isDev ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: isDev ? error.message : "Internal server error",
        ...(isDev && { stack: error.stack }),
      },
      { status: 500 }
    );
  }

  // 알 수 없는 에러 타입
  logger.error("Unknown error type", undefined, { error });

  return NextResponse.json(
    {
      success: false,
      error: "Internal server error",
    },
    { status: 500 }
  );
}

// 에러 메시지 추출 헬퍼 (기존 코드 호환성)
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

// 개발 환경 여부 (순환 참조 방지)
import { isDev } from "./env";
