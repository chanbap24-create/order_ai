// Claude API 기반 브랜드(와이너리) 조사 로직
// Sonnet + web_search 통합 검색 + Haiku 검증

import { getClaudeClient } from "@/app/lib/claudeClient";
import { logger } from "@/app/lib/logger";
import type { BrandResearchResult, BrandValidation } from "@/app/types/wine";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-20250514";

/** web_search 응답의 <cite> 태그 제거 */
function stripCitations(text: string): string {
  return text.replace(/<cite[^>]*>/g, '').replace(/<\/cite>/g, '');
}

/* ─── 구조화 프롬프트 ─── */
const BRAND_RESEARCH_PROMPT = `You are an expert wine industry researcher. Search the web thoroughly for information about the given wine producer/winery, then compile the results into structured JSON.

SEARCH STRATEGY (use web searches efficiently, max 5):
1. Search for the official winery website — extract history, philosophy, vineyard info
2. Search Wine-Searcher (wine-searcher.com) for the producer profile and scores
3. Search for awards, ratings, and additional details as needed

IMPORTANT RULES:
- Cross-reference information from multiple sources for accuracy
- Trust: Official site > Wine-Searcher > Vivino > Other sources
- Leave fields as empty string ("") if information is NOT confirmed
- Write description, history, winemaking_philosophy, vineyard_info in KOREAN (한글)
- Write brand_name_en, country, region, website in English
- Do NOT fabricate information
- description: 3-5 detailed sentences covering the brand's identity and reputation
- history: chronological timeline of key milestones
- awards: include specific scores and years (e.g., Robert Parker 95점(2020))

Return ONLY the JSON below (no other text):
{
  "brand_name_en": "Official English name of the winery/producer",
  "country": "Country in English",
  "region": "Specific wine region in English (e.g., Barossa Valley, Douro Valley)",
  "website": "Official website URL (only if confirmed)",
  "description": "Brand introduction in Korean (3-5 sentences)",
  "history": "Founding history in Korean (chronological milestones)",
  "winemaking_philosophy": "Winemaking philosophy in Korean (from grape to bottle)",
  "certifications": "Certifications (organic, biodynamic, sustainable, etc.)",
  "founded_year": null,
  "owner": "Current owner/group",
  "winemaker": "Head winemaker (current)",
  "vineyard_info": "Vineyard details in Korean (area, soil, climate, altitude, varieties)",
  "annual_production": "Annual production (bottles or cases)",
  "key_wines": "Flagship wines (comma-separated, with scores if available)",
  "awards": "Major awards/scores (specific scores and years)"
}`;

/* ─── Sonnet 통합 검색 + 구조화 (1-stage) ─── */
async function researchWithSonnet(
  client: ReturnType<typeof getClaudeClient>,
  brandNameKr: string,
  brandNameEn: string | undefined,
  country: string | undefined
): Promise<BrandResearchResult> {
  const searchTarget = brandNameEn || brandNameKr;
  const countryHint = country ? ` from ${country}` : '';

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    messages: [{
      role: "user",
      content: `${BRAND_RESEARCH_PROMPT}

=== TARGET ===
Korean name: ${brandNameKr}
English name: ${brandNameEn || '(unknown)'}
Country: ${country || '(unknown)'}

Please search thoroughly for "${searchTarget}"${countryHint} winery and compile all findings into the JSON format above.`
    }],
  });

  const texts: string[] = [];
  for (const block of response.content) {
    if (block.type === 'text' && block.text) texts.push(block.text);
  }
  const text = stripCitations(texts.join('\n').trim());

  if (!text) {
    throw new Error("Claude API 응답에 텍스트가 없습니다.");
  }

  // Extract JSON from response (may be wrapped in markdown code block)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find JSON object directly
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }
  }

  return JSON.parse(jsonStr) as BrandResearchResult;
}

/* ─── 검증 에이전트 (Haiku) ─── */
async function validateBrandResult(
  client: ReturnType<typeof getClaudeClient>,
  brandNameKr: string,
  brandNameEn: string | undefined,
  result: BrandResearchResult
): Promise<BrandValidation> {
  try {
    const prompt = `당신은 와인 업계 전문가입니다. 아래 브랜드 조사 결과의 정확성을 검증하세요.

원본 브랜드:
- 한글명: ${brandNameKr}
- 영문명: ${brandNameEn || '(미확인)'}

조사 결과:
- 영문명: ${result.brand_name_en}
- 국가: ${result.country}
- 지역: ${result.region}
- 설립: ${result.founded_year || '미확인'}
- 소유자: ${result.owner}
- 와인메이커: ${result.winemaker}
- 소개: ${result.description?.substring(0, 200)}...

검증 기준:
1. 브랜드명이 실제 존재하는 와이너리/프로듀서인가?
2. 국가/지역 정보가 실제와 일치하는가?
3. 설립연도가 합리적인가?
4. 소개 내용이 해당 브랜드에 맞는 정보인가?
5. 와인메이커/소유자 정보가 최신인가?

반드시 아래 JSON 형식으로만 응답하세요:
{"confidence": 0-100, "issues": ["문제점1", "문제점2"]}`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    if (!text) return { confidence: 50, issues: ["검증 응답 없음"] };

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as { confidence: number; issues: string[] };
    return {
      confidence: parsed.confidence,
      issues: parsed.issues || [],
    };
  } catch (e) {
    logger.error(`[BrandValidation] Failed: ${e instanceof Error ? e.message : String(e)}`);
    return { confidence: 75, issues: ["검증 실행 실패 - 기본 통과"] };
  }
}

/* ─── 메인 함수 ─── */
export async function researchBrandWithClaude(
  brandNameKr: string,
  brandNameEn?: string,
  country?: string
): Promise<{ result: BrandResearchResult; validation: BrandValidation }> {
  const client = getClaudeClient();
  const searchTarget = brandNameEn || brandNameKr;
  const countryHint = country ? ` (${country})` : '';

  logger.info(`[BrandResearch] Starting research for: ${searchTarget}${countryHint}`);

  // Step 1: Sonnet + web_search 통합 조사 (검색 + 구조화 한번에)
  const result = await researchWithSonnet(client, brandNameKr, brandNameEn, country);

  logger.info(`[BrandResearch] Research complete for "${searchTarget}": ${result.brand_name_en || 'N/A'}, desc=${(result.description || '').length}c`);

  // Step 2: Haiku 검증
  const validation = await validateBrandResult(client, brandNameKr, brandNameEn, result);

  logger.info(`[BrandResearch] Validated "${searchTarget}": confidence=${validation.confidence}, issues=${validation.issues.length}`);

  return { result, validation };
}
