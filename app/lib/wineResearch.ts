// 와인 조사 로직: Wine-Searcher 실제 데이터 + GPT 보완

import OpenAI from "openai";
import { logger } from "@/app/lib/logger";
import { scrapeWineSearcher, searchWineImage } from "@/app/lib/wineImageSearch";
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
You will receive a Korean wine name and real data from Wine-Searcher (if available).
Your task is to use the real data as the primary source and fill in any missing fields with your expert knowledge.

IMPORTANT:
- Use the Wine-Searcher data as-is for fields like grape variety, region, origin, and wine name
- DO NOT make up information - if Wine-Searcher data is provided, use it
- Only use your knowledge to supplement missing fields (tasting notes, food pairing, etc.)
- Tasting notes should be detailed and professional

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

export async function researchWine(itemCode: string, itemNameKr: string): Promise<WineResearchResult> {
  const client = getOpenAIClient();

  logger.info(`Researching wine: ${itemCode} - ${itemNameKr}`);

  // Step 1: Wine-Searcher에서 실제 데이터 검색
  let wsContext = "";
  let imageUrl: string | null = null;

  // 한글 이름으로 먼저 검색 시도
  const wsData = await scrapeWineSearcher(itemNameKr);

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
    logger.info(`[WineSearcher] Got data for ${itemCode}`, { name: wsData.name, varietal: wsData.varietal });
  } else {
    logger.info(`[WineSearcher] No data found for Korean name, will rely on GPT`);
  }

  // Step 2: GPT에 실제 데이터를 컨텍스트로 전달하여 구조화
  const userMessage = `와인 이름: ${itemNameKr}\n품번: ${itemCode}${wsContext}\n\n위 정보를 바탕으로 이 와인에 대해 조사해주세요. Wine-Searcher 데이터가 있다면 그것을 우선 사용하세요.`;

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

  // Step 3: 이미지 URL 설정
  // Wine-Searcher에서 이미 이미지를 얻었으면 사용, 아니면 영문명으로 재검색
  if (!imageUrl && result.item_name_en) {
    imageUrl = await searchWineImage(result.item_name_en);
  }
  if (imageUrl) {
    result.image_url = imageUrl;
    logger.info(`[WineImage] Image found for ${itemCode}: ${imageUrl}`);
  }

  logger.info(`Wine research complete for ${itemCode} (WS data: ${wsData ? 'yes' : 'no'})`);

  return result;
}
