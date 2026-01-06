// app/lib/translateOrder.ts
import OpenAI from "openai";
import { config } from "./config";

const client = new OpenAI({ apiKey: config.openai.apiKey });

function shouldTranslateToKorean(text: string) {
  const s = String(text || "");
  if (!s.trim()) return false;

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const hangul = (s.match(/[가-힣]/g) || []).length;
  const total = Math.max(1, s.length);

  const letterRatio = letters / total;

  if (hangul <= 1 && letterRatio >= 0.08) return true;
  if (hangul <= 3 && letterRatio >= 0.15) return true;

  return false;
}

// 프로세스 메모리 캐시
const cache = new Map<string, string>();

export async function translateOrderToKoreanIfNeeded(text: string) {
  const s = String(text || "").trim();
  if (!s) return { translated: false as const, text: s };
  if (!config.openai.apiKey) {
    return { translated: false as const, text: s, reason: "no_api_key" as const };
  }
  if (!shouldTranslateToKorean(s)) return { translated: false as const, text: s };

  if (cache.has(s)) {
    return { translated: true as const, text: cache.get(s)!, cached: true as const };
  }

  const prompt = `
너는 한국 와인 수입사 발주 파서의 전처리 번역기야.

목표:
- 입력이 영어/로마자 기반 발주 문장이면, 한국어 기반 품목 키워드로 바꿔서 "줄 단위" 주문 형태로 출력한다.
- 수량(숫자)은 절대 바꾸지 말고, 품목명과 수량은 같은 줄에 유지한다.
- 문장부호(, . ! ?)는 가능하면 제거하거나 줄바꿈으로 바꿔라.
- 사람 인사말/잡담은 제거해도 된다.

출력 형식:
- 순수 텍스트
- 한 줄에 한 품목
- bottle(s) / bt / btl / pcs => "병"으로 통일

입력:
${s}
`.trim();

  const resp = await client.responses.create({
    model: config.openai.model,
    input: prompt,
  });

  const out = (resp.output_text || "").trim();
  const finalText = out || s;

  cache.set(s, finalText);
  return { translated: true as const, text: finalText };
}
