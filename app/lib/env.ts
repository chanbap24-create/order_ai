// 환경 변수 검증 및 관리

type EnvConfig = {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  DB_PATH?: string;
  DATABASE_URL?: string;
  ORDER_AI_XLSX_PATH?: string;
  DATA_GO_KR_SERVICE_KEY?: string;
  NODE_ENV: "development" | "production" | "test";
  OPENAI_MODEL?: string;
  MAX_ITEMS?: string;
  MIN_MATCH_SCORE?: string;
  MIN_SCORE_GAP?: string;
};

const requiredEnvVars = ["OPENAI_API_KEY"] as const;

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

  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DB_PATH: process.env.DB_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    ORDER_AI_XLSX_PATH: process.env.ORDER_AI_XLSX_PATH,
    DATA_GO_KR_SERVICE_KEY: process.env.DATA_GO_KR_SERVICE_KEY,
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

// 환경 변수 재내보내기 (호환성 - 이미 위에서 export됨)
