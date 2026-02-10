// Claude API 클라이언트 싱글톤

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/app/lib/logger";

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    _client = new Anthropic({ apiKey });
    logger.info("Claude API client initialized");
  }
  return _client;
}
