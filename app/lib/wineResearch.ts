// GPT 와인 조사 로직

import OpenAI from "openai";
import { logger } from "@/app/lib/logger";
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

const RESEARCH_PROMPT = `You are a professional wine sommelier and researcher. Given a Korean wine name, research and provide detailed information about this wine.

Respond ONLY in valid JSON format with the following fields:
{
  "item_name_en": "English wine name",
  "country_en": "Country in English (e.g., France, Italy, USA)",
  "region": "Specific wine region (e.g., Bordeaux, Barolo, Napa Valley)",
  "grape_varieties": "Grape varieties used (e.g., Cabernet Sauvignon, Merlot)",
  "wine_type": "Type of wine (Red/White/Rosé/Sparkling/Dessert/Fortified)",
  "winemaking": "Brief description of winemaking process (aging, fermentation, etc.) in Korean",
  "color_note": "Tasting note for color/appearance in Korean",
  "nose_note": "Tasting note for nose/aroma in Korean",
  "palate_note": "Tasting note for palate/taste in Korean",
  "food_pairing": "Food pairing suggestions in Korean",
  "glass_pairing": "Recommended glass type in Korean (e.g., 보르도 글라스, 부르고뉴 글라스)",
  "serving_temp": "Recommended serving temperature in Korean (e.g., 16-18°C)",
  "awards": "Notable awards or ratings if known, in Korean (or 'N/A')"
}

Important:
- Tasting notes, food pairing, glass pairing, serving temp should be in Korean
- Wine name in English, country, region, grape should be in English
- Be specific and accurate
- If unsure about a field, provide a reasonable educated guess based on the wine type and region
- Do NOT include any text outside the JSON object`;

export async function researchWine(itemCode: string, itemNameKr: string): Promise<WineResearchResult> {
  const client = getOpenAIClient();

  logger.info(`Researching wine: ${itemCode} - ${itemNameKr}`);

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [
      { role: "system", content: RESEARCH_PROMPT },
      { role: "user", content: `와인 이름: ${itemNameKr}\n품번: ${itemCode}\n\n이 와인에 대해 조사해주세요.` },
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
  logger.info(`Wine research complete for ${itemCode}`);

  return result;
}
