// Claude API 기반 와인 조사 로직

import { getClaudeClient } from "@/app/lib/claudeClient";
import { logger } from "@/app/lib/logger";
import { scrapeWineSearcher } from "@/app/lib/wineImageSearch";
import type { WineResearchResult } from "@/app/types/wine";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

const RESEARCH_PROMPT = `당신은 전문 와인 소믈리에이자 와인 연구가입니다.
사용자가 제공한 와인 정보와 Wine-Searcher 실제 데이터를 기반으로 와인을 분석하세요.

중요 규칙:
- Wine-Searcher 데이터가 있으면 최우선으로 사용
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

export async function researchWineWithClaude(
  itemCode: string,
  itemNameKr: string,
  itemNameEn: string,
  vintage?: string
): Promise<WineResearchResult> {
  const client = getClaudeClient();

  if (!itemNameEn?.trim()) {
    throw new Error("영문명이 필요합니다. 영문명을 먼저 입력해주세요.");
  }

  logger.info(`[Claude] Researching wine: ${itemCode} - ${itemNameKr} (en: ${itemNameEn})`);

  // Step 1: Wine-Searcher에서 실제 데이터 검색 (5초 타임아웃)
  let wsContext = "";
  let imageUrl: string | null = null;

  let wsData = null;
  try {
    wsData = await Promise.race([
      scrapeWineSearcher(itemNameEn),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch {
    logger.warn(`[Claude][WineSearcher] Scrape failed/timeout for: ${itemNameEn}`);
  }

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
    logger.info(`[Claude][WineSearcher] Got data for ${itemCode}`, {
      name: wsData.name,
      varietal: wsData.varietal,
      hasImage: !!imageUrl,
    });
  } else {
    logger.info(`[Claude][WineSearcher] No data found for: ${itemNameEn}`);
  }

  // Step 2: Claude API 호출
  const vintageYear = parseVintage(vintage);
  const vintageInfo = vintageYear ? `\n빈티지: ${vintageYear}년` : '';
  const userMessage = `와인 이름(한글): ${itemNameKr}\n와인 이름(영문): ${itemNameEn}\n품번: ${itemCode}${vintageInfo}${wsContext}\n\n위 정보를 바탕으로 이 와인에 대해 조사해주세요. Wine-Searcher 데이터가 있다면 그것을 우선 사용하세요.${vintageYear ? `\n\n중요: 이 와인의 빈티지는 ${vintageYear}년입니다. vintage_note에 ${vintageYear}년의 기후, 작황, 포도 품질에 대해 구체적으로 작성해주세요.` : ''}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [
      { role: "user", content: `${RESEARCH_PROMPT}\n\n${userMessage}` },
    ],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '';
  if (!text) {
    throw new Error("Claude API 응답에 텍스트가 없습니다.");
  }

  // JSON 파싱 (코드블록 래핑 대응)
  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const result = JSON.parse(jsonStr) as WineResearchResult;

  // 이미지는 PPT 생성 시 별도 검색 (타임아웃 방지)
  if (imageUrl) {
    result.image_url = imageUrl;
  }

  logger.info(`[Claude] Wine research complete for ${itemCode} (WS data: ${wsData ? 'yes' : 'no'}, image: ${imageUrl ? 'yes' : 'no'})`);

  return result;
}
