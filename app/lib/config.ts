// 중앙 집중식 설정 관리

import { env } from "./env";

export const config = {
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || "gpt-4o-mini",
  },
  parsing: {
    maxItems: parseInt(env.MAX_ITEMS || "20", 10),
  },
  matching: {
    minScore: parseFloat(env.MIN_MATCH_SCORE || "0.85"),
    minGap: parseFloat(env.MIN_SCORE_GAP || "0.15"),
    // 거래처 매칭 설정
    client: {
      autoResolveScore: 0.93,
      autoResolveGap: 0.08,
      forceResolveMinScore: 0.45,
      forceResolveGap: 0.15,
    },
  },
  database: {
    path: env.DB_PATH || env.DATABASE_URL || "data.sqlite3",
  },
  excel: {
    path: env.ORDER_AI_XLSX_PATH,
  },
  holidays: {
    serviceKey: env.DATA_GO_KR_SERVICE_KEY,
  },
} as const;
