// app/lib/smartMatcher.ts
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
 * GPT 스마트 매칭: 룰 기반 후보들 중 최적 품목 선택
 * 
 * 사용 시나리오:
 * - 룰 기반으로 후보 3~5개 추출 (빠름)
 * - GPT로 최종 1개 선택 (정확함)
 */
export async function smartMatchItem(
  query: string,
  candidates: Array<{ item_no: string; item_name: string; score: number }>
): Promise<string | null> {
  
  // 후보가 없거나 1개면 GPT 불필요
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].item_no;
  
  // 스코어 차이가 크면 (0.3 이상) GPT 불필요
  const topScore = candidates[0].score;
  const secondScore = candidates[1]?.score || 0;
  if (topScore - secondScore >= 0.3) {
    return candidates[0].item_no;
  }

  // 환경변수로 활성화/비활성화
  if (process.env.ENABLE_SMART_MATCHING !== "true") {
    return candidates[0].item_no; // 최고 점수 반환
  }

  const candidateList = candidates
    .slice(0, 5) // 최대 5개만
    .map((c, i) => `${i + 1}. [${c.item_no}] ${c.item_name} (스코어: ${c.score.toFixed(2)})`)
    .join("\n");

  const prompt = `당신은 와인 품목 매칭 전문가입니다.

사용자가 "${query}"를 입력했습니다.

후보 품목들:
${candidateList}

질문: 어느 품목이 가장 적합합니까?

고려 사항:
- 품목명의 유사도
- 생산자명 (브랜드)
- 품종 (샤르도네, 카베르네 등)
- 빈티지 (연도)
- 일반적인 약어 관행

답변 형식: 품목번호만 출력 (예: 3A14001)
설명 불필요, 품목번호만 출력하세요.`;

  try {
    const resp = await getClient().chat.completions.create({
      model: config.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 50,
    });

    const output = resp.choices[0]?.message?.content?.trim() || "";
    const itemNo = output.replace(/[^A-Z0-9]/g, ""); // 품목번호만 추출
    
    // 유효한 후보 품목번호인지 확인
    if (candidates.some(c => c.item_no === itemNo)) {
      console.log(`[SmartMatch] Selected: ${itemNo} for query "${query}"`);
      return itemNo;
    }
    
    // GPT 응답이 이상하면 최고 점수 반환
    return candidates[0].item_no;
    
  } catch (error) {
    console.error("[SmartMatch] Error:", error);
    return candidates[0].item_no; // 실패 시 최고 점수 반환
  }
}
