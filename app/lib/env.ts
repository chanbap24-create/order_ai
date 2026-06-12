// 환경 변수 검증 및 관리

type EnvConfig = {
  OPENAI_API_KEY?: string;  // ✅ 선택 사항으로 변경 (번역 비활성화 시 불필요)
  ANTHROPIC_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // 세션 쿠키 HMAC 서명 시크릿. 미설정 시 SUPABASE_SERVICE_ROLE_KEY 폴백(경고 로그).
  // 프로덕션에서는 반드시 별도 시크릿 설정 (DB 키와 세션 키 분리).
  AUTH_SECRET?: string;
  // 원격 동기화 API용 bearer 토큰 (sync-agent.js 가 사용).
  // 미설정 시 /api/admin/remote-sync* 는 403 반환.
  REMOTE_SYNC_TOKEN?: string;
  ORDER_AI_XLSX_PATH?: string;
  DATA_GO_KR_SERVICE_KEY?: string;
  // Solapi 카카오 알림톡 (수금 연체 알림). 미설정 시 발송 비활성(no-op).
  SOLAPI_API_KEY?: string;
  SOLAPI_API_SECRET?: string;
  SOLAPI_PFID?: string;          // 카카오 비즈니스 채널 발신프로필 키
  SOLAPI_TEMPLATE_ID?: string;   // 승인된 알림톡 템플릿 ID
  SOLAPI_SENDER?: string;        // 발신 전화번호(알림톡 실패 시 SMS 대체)
  CRON_SECRET?: string;          // Vercel Cron 보호 시크릿 (Authorization: Bearer)
  NODE_ENV: "development" | "production" | "test";
  OPENAI_MODEL?: string;
  MAX_ITEMS?: string;
  MIN_MATCH_SCORE?: string;
  MIN_SCORE_GAP?: string;
};

const requiredEnvVars = [] as const;  // ✅ OPENAI_API_KEY 필수 제거

function validateEnv(): EnvConfig {
  const missing: string[] = [];

  // 필수 환경 변수 검증
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please check your .env file or environment configuration.`
    );
  }

  const nodeEnv = (process.env.NODE_ENV || "development") as EnvConfig["NODE_ENV"];
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be development, production, or test.`);
  }

  // AUTH_SECRET 미설정 시 SUPABASE_SERVICE_ROLE_KEY 폴백 + 프로덕션 경고 (H-1).
  // throw 로 강제하면 미설정 환경에서 빌드/부팅이 막히므로, 환경변수 설정 확인 전까지는
  // 경고로만 둔다. 실제 서명은 sessionSecret.ts 가 담당.
  const authSecret = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    console.warn(
      "[SECURITY] AUTH_SECRET not set in production; falling back to SUPABASE_SERVICE_ROLE_KEY. "
      + "Set AUTH_SECRET to a separate random string to decouple DB key from session signing.",
    );
  }

  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH_SECRET: authSecret,
    REMOTE_SYNC_TOKEN: process.env.REMOTE_SYNC_TOKEN,
    ORDER_AI_XLSX_PATH: process.env.ORDER_AI_XLSX_PATH,
    DATA_GO_KR_SERVICE_KEY: process.env.DATA_GO_KR_SERVICE_KEY,
    SOLAPI_API_KEY: process.env.SOLAPI_API_KEY,
    SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET,
    SOLAPI_PFID: process.env.SOLAPI_PFID,
    SOLAPI_TEMPLATE_ID: process.env.SOLAPI_TEMPLATE_ID,
    SOLAPI_SENDER: process.env.SOLAPI_SENDER,
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: nodeEnv,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    MAX_ITEMS: process.env.MAX_ITEMS,
    MIN_MATCH_SCORE: process.env.MIN_MATCH_SCORE,
    MIN_SCORE_GAP: process.env.MIN_SCORE_GAP,
  };
}

// 앱 시작 시 검증 (모듈 로드 시점)
export const env = validateEnv();

// 환경 변수 접근 헬퍼
export function getEnv(key: keyof EnvConfig): string | undefined {
  return env[key];
}

// 개발 환경 여부
export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

