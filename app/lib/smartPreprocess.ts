// app/lib/smartPreprocess.ts
import OpenAI from "openai";
import { config } from "./config";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

/**
 * GPT 스마트 전처리: 자연어 주문을 표준 형식으로 정규화
 */
export async function smartPreprocessOrder(text: string): Promise<string> {
  // 환경변수로 활성화/비활성화
  if (process.env.ENABLE_SMART_PREPROCESS !== "true") {
    return text;
  }

  const prompt = `당신은 한국 와인 주문 전처리 전문가입니다.

목표: 자연어 주문을 "품목명 + 수량" 형식으로 정규화

규칙:
1. 한글 수량을 숫자로 변환 (한→1, 두→2, 세→3, 네→4, 다섯→5, etc)
2. "케이스"는 12병으로 변환
3. "박스"는 6병으로 변환 (문맥상 판단)
4. 불필요한 인사말/조사 제거 (주세요, 부탁드려요, etc)
5. 한 줄에 한 품목 (줄바꿈으로 구분)
6. 빈티지(연도)는 보존
7. 숫자는 항상 아라비아 숫자 사용

입력 예시:
"샤또마르고 한 케이스와 피노누아 세병 주세요"

출력 예시:
샤또마르고 12
피노누아 3

입력:
${text}

출력 (순수 텍스트만):`;

  try {
    const resp = await getClient().chat.completions.create({
      model: config.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // 매우 낮게 (일관성 중시)
      max_tokens: 500,
    });

    const output = resp.choices[0]?.message?.content?.trim() || text;
    console.log("[SmartPreprocess] Input:", text);
    console.log("[SmartPreprocess] Output:", output);
    
    return output;
  } catch (error) {
    console.error("[SmartPreprocess] Error:", error);
    return text; // 실패 시 원본 반환
  }
}
