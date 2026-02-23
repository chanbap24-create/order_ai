// Claude API 기반 와인 조사 로직

import { getClaudeClient } from "@/app/lib/claudeClient";
import { logger } from "@/app/lib/logger";
import { scrapeWineSearcher, searchWineImage, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { getBrandContextForWine } from "@/app/lib/brandDb";
import type { WineResearchResult, WineValidation } from "@/app/types/wine";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** web_search 응답의 <cite> 태그 제거 */
function stripCitations(text: string): string {
  return text.replace(/<cite[^>]*>/g, '').replace(/<\/cite>/g, '');
}

const RESEARCH_PROMPT = `당신은 전문 와인 소믈리에이자 와인 연구가입니다.
사용자가 제공한 와인 정보와 Wine-Searcher 실제 데이터를 기반으로 와인을 분석하세요.

중요 규칙:
- Wine-Searcher 데이터가 있으면 최우선으로 사용
- 브랜드 자료실 DB 정보가 있으면 winery_description, winemaking에 적극 활용 (양조 철학, 포도밭, 와인메이커 등)
- 브랜드 DB의 수상 내역(awards)에서 해당 와인 관련 점수를 추출하여 활용
- 데이터가 없는 필드만 전문 지식으로 보완
- 허위 정보를 만들지 말 것
- 테이스팅 노트는 전문적이고 상세하게

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "item_name_en": "영문 와인명 (Wine-Searcher 데이터 우선)",
  "country_en": "영문 국가명",
  "region": "영문 세부 산지",
  "grape_varieties": "영문 품종 (여러 개면 쉼표 구분)",
  "wine_type": "Red/White/Rosé/Sparkling/Dessert/Fortified",
  "alcohol_percentage": "알코올 도수 (예: 13.5%)",
  "winery_description": "와이너리 소개 (한글, 2-3문장)",
  "winemaking": "양조 방법 (한글, 수확부터 숙성까지)",
  "vintage_note": "빈티지 특성 (한글, 해당 연도 기후/특징)",
  "aging_potential": "숙성 잠재력 (한글, 예: 5-10년 숙성 가능)",
  "color_note": "외관/색상 (한글, 전문 테이스팅 노트)",
  "nose_note": "향 (한글, 전문 테이스팅 노트)",
  "palate_note": "맛/입안 느낌 (한글, 전문 테이스팅 노트)",
  "food_pairing": "음식 페어링 (한글, 구체적 요리명)",
  "glass_pairing": "추천 글라스 (한글, 예: 보르도 글라스)",
  "serving_temp": "서빙 온도 (예: 16-18°C)",
  "awards": "수상 내역 또는 평점 (없으면 N/A)"
}`;

/** 빈티지 약식 → 4자리 연도 변환 (15→2015, 99→1999, NV→NV) */
function parseVintage(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === 'NV' || trimmed === 'MV' || trimmed === 'N/V') return trimmed;
  if (/^\d{4}$/.test(trimmed)) return trimmed; // 이미 4자리
  const num = parseInt(trimmed, 10);
  if (isNaN(num)) return trimmed;
  // 2자리: 현재연도(26) 이하면 2000년대, 초과면 1900년대
  if (num >= 0 && num <= 99) {
    return num > 26 ? `19${String(num).padStart(2, '0')}` : `20${String(num).padStart(2, '0')}`;
  }
  return trimmed;
}

/** Haiku 모델로 조사 결과가 원본 와인과 동일한지 빠르게 검증 */
async function validateWineResult(
  originalNameKr: string,
  originalNameEn: string,
  result: WineResearchResult
): Promise<WineValidation> {
  try {
    const client = getClaudeClient();

    const prompt = `당신은 와인 전문가입니다. 아래 원본 와인과 조사 결과가 같은 와인인지 판단하세요.

원본 와인:
- 한글명: ${originalNameKr}
- 영문명: ${originalNameEn}

조사 결과:
- 영문명: ${result.item_name_en}
- 국가: ${result.country_en}
- 타입: ${result.wine_type}
- 품종: ${result.grape_varieties}

판단 기준:
1. 와인명이 같은 와인을 가리키는지 (약간의 표기 차이는 허용)
2. 국가/지역이 합리적인지
3. 품종과 타입이 서로 맞는지 (예: Cabernet Sauvignon → Red)

반드시 아래 JSON 형식으로만 응답하세요:
{"same_wine": true/false, "confidence": 0-100, "issues": ["문제점1", "문제점2"]}`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    if (!text) return { confidence: 50, issues: ["검증 응답 없음"] };

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as { same_wine: boolean; confidence: number; issues: string[] };
    return {
      confidence: parsed.confidence,
      issues: parsed.issues || [],
    };
  } catch (e) {
    logger.error(`[Validation] Failed: ${e instanceof Error ? e.message : String(e)}`);
    // 검증 실패 시 통과 처리 (조사 자체를 막지 않음)
    return { confidence: 75, issues: ["검증 실행 실패 - 기본 통과"] };
  }
}

export async function researchWineWithClaude(
  itemCode: string,
  itemNameKr: string,
  itemNameEn: string,
  vintage?: string
): Promise<{ result: WineResearchResult; validation: WineValidation }> {
  const client = getClaudeClient();

  if (!itemNameEn?.trim()) {
    throw new Error("영문명이 필요합니다. 영문명을 먼저 입력해주세요.");
  }

  logger.info(`[Claude] Researching wine: ${itemCode} - ${itemNameKr} (en: ${itemNameEn})`);

  // Step 1: DB 브랜드 데이터 + Wine-Searcher + Vivino 병렬 실행 (무료)
  const [wsData, vivinoImageUrl, dbBrandContext] = await Promise.all([
    scrapeWineSearcher(itemNameEn),
    searchVivinoBottleImage(itemNameEn).catch(() => null),
    getBrandContextForWine(itemCode).catch(() => ''),
  ]);

  if (dbBrandContext) {
    logger.info(`[Claude] Using DB brand data for ${itemCode} (${dbBrandContext.length} chars)`);
  }

  let wsContext = "";
  let imageUrl: string | null = vivinoImageUrl;

  if (wsData) {
    wsContext = `\n\n=== Wine-Searcher 실제 데이터 ===\n`;
    if (wsData.name) wsContext += `와인명: ${wsData.name}\n`;
    if (wsData.varietal) wsContext += `품종: ${wsData.varietal}\n`;
    if (wsData.region) wsContext += `지역: ${wsData.region}\n`;
    if (wsData.origin) wsContext += `원산지: ${wsData.origin}\n`;
    if (wsData.description) wsContext += `설명: ${wsData.description}\n`;
    if (wsData.reviews && wsData.reviews.length > 0) {
      wsContext += `리뷰:\n${wsData.reviews.map(r => `- ${r}`).join('\n')}\n`;
    }
    if (!imageUrl) {
      imageUrl = wsData.imageUrl || null;
    }
    logger.info(`[Claude][WineSearcher] Got data for ${itemCode}`, {
      name: wsData.name,
      varietal: wsData.varietal,
      hasImage: !!imageUrl,
    });
  } else {
    logger.info(`[Claude][WineSearcher] No data found for: ${itemNameEn}`);
  }

  // 브랜드 컨텍스트
  let brandContext = '';
  if (dbBrandContext) {
    brandContext = `\n\n=== 브랜드 자료실 DB 정보 ===\n${dbBrandContext}\n`;
  }

  // 컨텍스트 풍부도 판단: WS 또는 브랜드DB 있으면 web_search 불필요
  const hasRichContext = !!(wsData || dbBrandContext);

  // Step 2: Haiku 메인 조사 (컨텍스트 부족 시에만 web_search 추가)
  const vintageYear = parseVintage(vintage);
  const vintageInfo = vintageYear ? `\n빈티지: ${vintageYear}년` : '';
  const userMessage = `와인 이름(한글): ${itemNameKr}\n와인 이름(영문): ${itemNameEn}\n품번: ${itemCode}${vintageInfo}${wsContext}${brandContext}\n\n위 정보를 바탕으로 이 와인에 대해 조사해주세요.${wsData ? ' Wine-Searcher 데이터를 우선 사용하세요.' : ''}${dbBrandContext ? ' 브랜드 DB 정보를 와이너리 소개와 양조에 활용하세요.' : ''}${vintageYear ? `\n\n중요: 빈티지 ${vintageYear}년의 기후, 작황에 대해 vintage_note에 구체적으로 작성해주세요.` : ''}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiParams: any = {
    model: HAIKU_MODEL,
    max_tokens: 1500,
    messages: [
      { role: "user", content: `${RESEARCH_PROMPT}\n\n${userMessage}` },
    ],
  };
  // 컨텍스트 부족 시에만 web_search 사용 (비용 절감)
  if (!hasRichContext) {
    apiParams.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
  }

  const response = await client.messages.create(apiParams);

  const texts: string[] = [];
  for (const block of response.content) {
    if (block.type === 'text' && 'text' in block) texts.push(block.text);
  }
  const text = stripCitations(texts.join('\n').trim());
  if (!text) {
    throw new Error("Claude API 응답에 텍스트가 없습니다.");
  }

  // JSON 파싱 (코드블록 래핑 제거 → { } 추출)
  let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) jsonStr = objMatch[0];

  let result: WineResearchResult;
  try {
    result = JSON.parse(jsonStr) as WineResearchResult;
  } catch (parseErr) {
    logger.error(`[Claude] JSON parse failed. Raw text (first 500 chars): ${text.slice(0, 500)}`);
    throw new Error(`JSON 파싱 실패: ${(parseErr as Error).message} | 응답: ${text.slice(0, 200)}`);
  }

  // Step 3: 이미지 보완 (Vivino/WS 없으면 fallback)
  if (!imageUrl && result.item_name_en) {
    const fallbackImage = await searchWineImage(result.item_name_en).catch(() => null);
    if (fallbackImage) imageUrl = fallbackImage;
  }
  if (imageUrl) {
    result.image_url = imageUrl;
    logger.info(`[Claude][WineImage] Image found for ${itemCode}: ${imageUrl}`);
  }

  // Step 4: 검증 — 컨텍스트 풍부하면 스킵 (WS+브랜드 둘 다 있으면 신뢰도 높음)
  let validation: WineValidation;
  if (wsData && dbBrandContext) {
    // WS 데이터 + 브랜드DB 모두 있으면 검증 스킵
    validation = { confidence: 95, issues: [] };
    logger.info(`[Claude] Skipping validation — rich context (WS+brand DB)`);
  } else {
    validation = await validateWineResult(itemNameKr, itemNameEn, result);
  }

  logger.info(`[Claude] Wine research complete for ${itemCode} (WS: ${wsData ? 'yes' : 'no'}, brand: ${dbBrandContext ? 'DB' : 'no'}, image: ${imageUrl ? 'yes' : 'no'}, validation: ${validation.confidence})`);

  return { result, validation };
}
