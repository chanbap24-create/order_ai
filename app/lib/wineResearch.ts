// 와인 조사 로직: 브랜드 컨텍스트 + Wine-Searcher 실제 데이터 + GPT 보완

import OpenAI from "openai";
import { logger } from "@/app/lib/logger";
import { scrapeWineSearcher, searchWineImage, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { getBrandContextForWine } from "@/app/lib/brandDb";
import type { WineResearchResult } from "@/app/types/wine";

let _client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

const RESEARCH_PROMPT = `You are a professional wine sommelier and researcher.
You will receive a Korean wine name, real data from Wine-Searcher (if available), and brand/producer research data (if available).

DATA PRIORITY:
1. Wine-Searcher data (most reliable for specific wine info)
2. Brand research data (reliable for producer, region, winemaking context)
3. Your expert knowledge (only to supplement missing fields)

IMPORTANT:
- Use Wine-Searcher data as-is for grape variety, region, origin, and wine name
- Use brand research data for winemaking philosophy, vineyard info, and producer context
- DO NOT make up information
- Tasting notes should be detailed, professional, and consistent with the producer's known style
- If brand data mentions specific winemaking methods, reflect them in the winemaking field

Respond ONLY in valid JSON format with the following fields:
{
  "item_name_en": "English wine name (use Wine-Searcher name if available)",
  "country_en": "Country in English (from origin data)",
  "region": "Specific wine region (from origin data)",
  "grape_varieties": "Grape varieties (from varietal data)",
  "wine_type": "Type of wine (Red/White/Rosé/Sparkling/Dessert/Fortified)",
  "winemaking": "Brief winemaking process description in Korean",
  "color_note": "Tasting note for color/appearance in Korean",
  "nose_note": "Tasting note for nose/aroma in Korean",
  "palate_note": "Tasting note for palate/taste in Korean",
  "food_pairing": "Food pairing suggestions in Korean",
  "glass_pairing": "Recommended glass type in Korean (e.g., 보르도 글라스, 부르고뉴 글라스)",
  "serving_temp": "Recommended serving temperature in Korean (e.g., 16-18°C)",
  "awards": "Notable awards or ratings from the reviews (or 'N/A')"
}

Important:
- Tasting notes, food pairing, glass pairing, serving temp, winemaking should be in Korean
- Wine name, country, region, grape should be in English
- Be specific and accurate - prefer real data over guesses
- Do NOT include any text outside the JSON object`;

/** Step 0: 한글 와인명 → 영문 와인명 변환 (GPT 경량 호출) */
async function translateWineName(client: OpenAI, itemNameKr: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 100,
    messages: [
      {
        role: "system",
        content: "You are a wine name translator. Given a Korean wine name, return ONLY the original English/French wine name. No explanation, no quotes, just the wine name. Example: 샤또 라그랑쥬 → Chateau Lagrange",
      },
      { role: "user", content: itemNameKr },
    ],
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

export async function researchWine(itemCode: string, itemNameKr: string, itemNameEn?: string): Promise<WineResearchResult> {
  const client = getOpenAIClient();

  logger.info(`Researching wine: ${itemCode} - ${itemNameKr} (en: ${itemNameEn || 'none'})`);

  // Step 0: 브랜드 컨텍스트 조회 (병렬로 미리 시작)
  const brandContextPromise = getBrandContextForWine(itemCode);

  // Step 1: 영문명 결정 (이미 있으면 사용, 없으면 GPT로 번역)
  let englishName = itemNameEn?.trim() || "";
  if (!englishName) {
    try {
      englishName = await translateWineName(client, itemNameKr);
      logger.info(`[Translate] ${itemNameKr} → ${englishName}`);
    } catch (e) {
      logger.warn(`[Translate] Failed to translate wine name`, { error: e });
    }
  } else {
    logger.info(`[Research] Using provided English name: ${englishName}`);
  }

  // Step 1.5: 브랜드 컨텍스트 결과 수집
  const brandCtx = await brandContextPromise;
  if (brandCtx) {
    logger.info(`[BrandContext] Using brand data for ${itemCode}: ${brandCtx.brandNameEn}`);
  }

  // Step 2: Wine-Searcher에서 영문명으로 실제 데이터 검색
  let wsContext = "";
  let imageUrl: string | null = null;

  const searchName = englishName || itemNameKr;
  const wsData = await scrapeWineSearcher(searchName);

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
    imageUrl = wsData.imageUrl || null;
    logger.info(`[WineSearcher] Got data for ${itemCode}`, { name: wsData.name, varietal: wsData.varietal, hasImage: !!imageUrl });
  } else {
    logger.info(`[WineSearcher] No data found for: ${searchName}`);
  }

  // 브랜드 컨텍스트를 GPT 프롬프트에 추가
  let brandContext = "";
  if (brandCtx?.text) {
    brandContext = `\n\n=== 브랜드(생산자) 조사 데이터 ===\n${brandCtx.text}\n`;
  }

  // Step 3: GPT에 실제 데이터를 컨텍스트로 전달하여 구조화
  const userMessage = `와인 이름(한글): ${itemNameKr}\n와인 이름(영문 추정): ${englishName}\n품번: ${itemCode}${wsContext}${brandContext}\n\n위 정보를 바탕으로 이 와인에 대해 조사해주세요. Wine-Searcher 데이터가 있다면 그것을 우선 사용하고, 브랜드 데이터가 있다면 양조 방법과 테이스팅 노트 작성에 활용하세요.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      { role: "system", content: RESEARCH_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI API 응답에 텍스트가 없습니다.");
  }

  // JSON 파싱 (코드블록 래핑 대응)
  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const result = JSON.parse(jsonStr) as WineResearchResult;

  // Step 4: 이미지 검색 (브랜드 컨텍스트 활용으로 정확도 향상)
  // 검색어 전략: GPT가 확인한 정확한 영문명 > 브랜드명+와인명 조합 > 원래 영문명
  const confirmedEnName = result.item_name_en || englishName;

  if (!imageUrl) {
    // 4-1. 정확한 영문명으로 Vivino 보틀샷 검색 (가장 정확)
    imageUrl = await searchVivinoBottleImage(confirmedEnName);

    // 4-2. 브랜드명을 포함한 검색 (브랜드 컨텍스트가 있으면 더 정확한 검색어 구성)
    if (!imageUrl && brandCtx?.brandNameEn) {
      const brandPrefixedSearch = confirmedEnName.toLowerCase().includes(brandCtx.brandNameEn.toLowerCase())
        ? confirmedEnName
        : `${brandCtx.brandNameEn} ${confirmedEnName}`;
      if (brandPrefixedSearch !== confirmedEnName) {
        imageUrl = await searchVivinoBottleImage(brandPrefixedSearch);
        if (imageUrl) {
          logger.info(`[WineImage] Found via brand-prefixed search: ${brandPrefixedSearch}`);
        }
      }
    }

    // 4-3. Wine-Searcher fallback
    if (!imageUrl) {
      const wsRetry = await scrapeWineSearcher(confirmedEnName);
      imageUrl = wsRetry?.imageUrl || null;
    }
  }

  if (imageUrl) {
    result.image_url = imageUrl;
    logger.info(`[WineImage] Image found for ${itemCode}: ${imageUrl}`);
  }

  // 브랜드 컨텍스트 활용 여부 로깅
  logger.info(`Wine research complete for ${itemCode} (WS: ${wsData ? 'yes' : 'no'}, brand: ${brandCtx ? 'yes' : 'no'}, image: ${imageUrl ? 'yes' : 'no'})`);

  return result;
}
