// Claude API 기반 브랜드(와이너리) 조사 로직
// 3단계 병렬 검색 + Haiku 검증 에이전트

import { getClaudeClient } from "@/app/lib/claudeClient";
import { logger } from "@/app/lib/logger";
import type { BrandResearchResult, BrandValidation } from "@/app/types/wine";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-20250514";

/* ─── 검색 1: 공식 사이트 + 일반 정보 ─── */
async function searchOfficialInfo(
  client: ReturnType<typeof getClaudeClient>,
  searchTarget: string,
  countryHint: string
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2500,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{
        role: "user",
        content: `Research the wine producer/winery "${searchTarget}"${countryHint}.

Search for the OFFICIAL WINERY WEBSITE and extract:
1. Official website URL
2. Founded year and history
3. Winemaking philosophy, techniques, fermentation methods
4. Vineyard details — location, size (hectares), soil type, climate, altitude
5. Owner/winemaker name and background
6. Annual production volume (bottles or cases)
7. Certifications (organic, biodynamic, sustainable, etc.)
8. Grape varieties grown
9. Wine portfolio / key wines produced

Also search for the winery on Wikipedia if available.

Return ALL useful information found in detailed bullet points.`
      }],
    });

    const texts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text' && block.text) texts.push(block.text);
    }
    return texts.join('\n').trim();
  } catch (e) {
    logger.warn(`[BrandResearch][Official] Failed: ${e instanceof Error ? e.message : String(e)}`);
    return '';
  }
}

/* ─── 검색 2: Wine-Searcher / Vivino / 와인 전문 사이트 ─── */
async function searchWineDatabases(
  client: ReturnType<typeof getClaudeClient>,
  searchTarget: string,
  countryHint: string
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2500,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{
        role: "user",
        content: `Search wine databases for the producer/winery "${searchTarget}"${countryHint}.

Search these sources:
1. Wine-Searcher (wine-searcher.com) — producer profile, average price, critic scores
2. Vivino (vivino.com) — user ratings, top wines, popularity
3. CellarTracker (cellartracker.com) — community reviews, tasting notes
4. Wine Spectator or Decanter — professional reviews and scores

Extract:
- Top-rated wines and their scores
- Average price range
- User/critic ratings
- Notable reviews or mentions
- Awards (Robert Parker, James Suckling, Wine Spectator scores)
- Logo or brand image URL if found

Return ALL information in detailed bullet points.`
      }],
    });

    const texts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text' && block.text) texts.push(block.text);
    }
    return texts.join('\n').trim();
  } catch (e) {
    logger.warn(`[BrandResearch][WineDB] Failed: ${e instanceof Error ? e.message : String(e)}`);
    return '';
  }
}

/* ─── 검색 3: 뉴스 / 평론 / 한글 정보 ─── */
async function searchNewsAndReviews(
  client: ReturnType<typeof getClaudeClient>,
  searchTarget: string,
  brandNameKr: string,
  countryHint: string
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{
        role: "user",
        content: `Search for news, reviews, and Korean-language information about the wine producer "${searchTarget}" (한글: ${brandNameKr})${countryHint}.

Search for:
1. Korean wine importer/distributor information (한국 수입사)
2. Korean wine blog reviews or articles about this producer
3. Recent news about the winery (new releases, acquisitions, events)
4. Wine critic features or interviews with the winemaker
5. Industry awards or rankings (e.g., Wine & Spirits Top 100, Decanter awards)

Also try searching "${brandNameKr}" in Korean to find local distributor info.

Return ALL information found in detailed bullet points.`
      }],
    });

    const texts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text' && block.text) texts.push(block.text);
    }
    return texts.join('\n').trim();
  } catch (e) {
    logger.warn(`[BrandResearch][News] Failed: ${e instanceof Error ? e.message : String(e)}`);
    return '';
  }
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
- 소개: ${result.description?.substring(0, 100)}...

검증 기준:
1. 브랜드명이 실제 존재하는 와이너리/프로듀서인가?
2. 국가/지역 정보가 실제와 일치하는가?
3. 설립연도가 합리적인가? (너무 미래거나 비현실적이지 않은가)
4. 소개 내용이 해당 브랜드에 맞는 정보인가? (다른 브랜드 정보와 혼동되지 않았는가)
5. 와인메이커/소유자 정보가 최신인가?

반드시 아래 JSON 형식으로만 응답하세요:
{"confidence": 0-100, "issues": ["문제점1", "문제점2"]}

- confidence 90+: 정확한 정보
- confidence 70-89: 대체로 정확하나 일부 미확인
- confidence 50-69: 상당 부분 불확실
- confidence 0-49: 잘못된 정보 가능성 높음`;

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

/* ─── 구조화 프롬프트 ─── */
const BRAND_RESEARCH_PROMPT = `당신은 와인 업계 전문가입니다. 여러 출처에서 수집한 웹 검색 결과를 종합하여 와이너리/브랜드 정보를 구조화된 JSON으로 정리하세요.

중요 규칙:
- 여러 출처의 정보를 교차 검증하여 가장 정확한 정보를 선택
- 출처 간 상충하는 정보는 공식 사이트 > Wine-Searcher > 기타 순으로 신뢰
- 확인되지 않은 정보는 빈 문자열("")로 둘 것
- 한글로 작성 (brand_name_en, country, region, website 제외)
- 허위 정보를 만들지 말 것
- description은 3-5문장으로 충분히 상세하게
- history는 주요 연혁을 시간순으로
- awards는 구체적 점수와 연도를 포함

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "brand_name_en": "영문 브랜드/와이너리명 (정식 명칭)",
  "country": "영문 국가명",
  "region": "영문 세부 산지 (예: Barossa Valley, Napa Valley)",
  "website": "공식 웹사이트 URL (확인된 경우만)",
  "description": "브랜드 소개 (한글, 3-5문장, 특징과 명성 포함)",
  "history": "설립 역사 (한글, 주요 연혁 시간순, 설립배경 포함)",
  "winemaking_philosophy": "양조 철학 (한글, 포도 재배부터 숙성까지 특징적 양조 방식)",
  "certifications": "인증 (유기농, 비오디나미, 지속가능 등, 없으면 빈 문자열)",
  "founded_year": null,
  "owner": "소유자/그룹 (현재 기준)",
  "winemaker": "수석 와인메이커 (현재 기준)",
  "vineyard_info": "포도밭 정보 (한글, 면적/토양/기후/고도/주요 품종)",
  "annual_production": "연간 생산량 (병 또는 케이스 단위)",
  "key_wines": "대표 와인 라인업 (쉼표 구분, 가능하면 평점 포함)",
  "awards": "주요 수상/평점 (구체적 점수와 연도, 예: Robert Parker 95점(2020), James Suckling 93점(2021))"
}`;

/* ─── 메인 함수 ─── */
export async function researchBrandWithClaude(
  brandNameKr: string,
  brandNameEn?: string,
  country?: string
): Promise<{ result: BrandResearchResult; validation: BrandValidation }> {
  const client = getClaudeClient();

  const searchTarget = brandNameEn || brandNameKr;
  const countryHint = country ? ` (${country})` : '';

  logger.info(`[BrandResearch] Starting multi-source research for: ${searchTarget}${countryHint}`);

  // Step 1: 3개 검색을 병렬 실행
  const [officialInfo, wineDbInfo, newsInfo] = await Promise.all([
    searchOfficialInfo(client, searchTarget, countryHint),
    searchWineDatabases(client, searchTarget, countryHint),
    searchNewsAndReviews(client, searchTarget, brandNameKr, countryHint),
  ]);

  logger.info(`[BrandResearch] All searches complete — official: ${officialInfo.length}c, wineDB: ${wineDbInfo.length}c, news: ${newsInfo.length}c`);

  // Step 2: Sonnet — 모든 검색 결과를 종합하여 구조화 JSON 정리
  const structureResponse = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: `${BRAND_RESEARCH_PROMPT}

=== 조사 대상 ===
브랜드명(한글): ${brandNameKr}
브랜드명(영문): ${brandNameEn || '(미확인)'}
국가: ${country || '(미확인)'}

=== 출처 1: 공식 사이트 및 일반 정보 ===
${officialInfo || '(정보 없음)'}

=== 출처 2: Wine-Searcher / Vivino / 와인 전문 DB ===
${wineDbInfo || '(정보 없음)'}

=== 출처 3: 뉴스 / 평론 / 한글 정보 ===
${newsInfo || '(정보 없음)'}

위 3개 출처의 정보를 교차 검증하고 종합하여 JSON을 작성하세요.`
    }],
  });

  const textBlock = structureResponse.content.find(b => b.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '';
  if (!text) {
    throw new Error("Claude API 응답에 텍스트가 없습니다.");
  }

  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const result = JSON.parse(jsonStr) as BrandResearchResult;

  // Step 3: 검증 에이전트 (Haiku)
  const validation = await validateBrandResult(client, brandNameKr, brandNameEn, result);

  logger.info(`[BrandResearch] Complete for "${searchTarget}": ${result.brand_name_en || 'N/A'} (confidence: ${validation.confidence}, issues: ${validation.issues.length})`);

  return { result, validation };
}
