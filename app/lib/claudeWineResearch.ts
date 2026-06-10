// Claude API 기반 와인 조사 로직

import { getClaudeClient } from "@/app/lib/claudeClient";
import { logger } from "@/app/lib/logger";
import { scrapeWineSearcher, searchWineImage, searchVivinoBottleImage, searchWineryWebsiteImage } from "@/app/lib/wineImageSearch";
import { getBrandContextForWine } from "@/app/lib/brandDb";
import { RESEARCH_PROMPT } from "@/app/lib/wineResearchPrompt";
import type { WineResearchResult, WineValidation } from "@/app/types/wine";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
// 테이스팅 노트 생성은 사실성·문장 품질이 중요 → Sonnet. (가벼운 매칭 검증은 Haiku 유지)
const RESEARCH_MODEL = "claude-sonnet-4-6";

/** web_search 응답의 <cite> 태그 제거 */
function stripCitations(text: string): string {
  return text.replace(/<cite[^>]*>/g, '').replace(/<\/cite>/g, '');
}

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
  result: WineResearchResult,
  originalSupplier?: string
): Promise<WineValidation> {
  try {
    const client = getClaudeClient();

    const supplierLine = originalSupplier ? `\n- 생산자/브랜드: ${originalSupplier}` : '';
    const supplierCriteria = originalSupplier
      ? `\n4. 생산자/와이너리가 같은 곳인지 (가장 중요! 생산자가 다르면 confidence를 30 이하로 낮추세요)`
      : '';

    const prompt = `당신은 와인 전문가입니다. 아래 원본 와인과 조사 결과가 같은 와인인지 판단하세요.

원본 와인:
- 한글명: ${originalNameKr}
- 영문명: ${originalNameEn}${supplierLine}

조사 결과:
- 영문명: ${result.item_name_en}
- 국가: ${result.country_en}
- 타입: ${result.wine_type}
- 품종: ${result.grape_varieties}
- 와이너리: ${result.winery_description?.slice(0, 100) || 'N/A'}

판단 기준:
1. 와인명이 같은 와인을 가리키는지 (약간의 표기 차이는 허용)
2. 국가/지역이 합리적인지
3. 품종과 타입이 서로 맞는지 (예: Cabernet Sauvignon → Red)${supplierCriteria}

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

export type VerificationStatus = 'verified' | 'warning' | 'mismatch';

export async function researchWineWithClaude(
  itemCode: string,
  itemNameKr: string,
  itemNameEn: string,
  vintage?: string,
  supplier?: string
): Promise<{ result: WineResearchResult; validation: WineValidation; verification_status: VerificationStatus }> {
  const client = getClaudeClient();

  if (!itemNameEn?.trim()) {
    throw new Error("영문명이 필요합니다. 영문명을 먼저 입력해주세요.");
  }

  logger.info(`[Claude] Researching wine: ${itemCode} - ${itemNameKr} (en: ${itemNameEn})`);

  // Step 1: DB 브랜드 데이터 + Wine-Searcher + Vivino 병렬 실행 (무료)
  const [wsData, vivinoImageUrl, dbBrandContext] = await Promise.all([
    scrapeWineSearcher(itemNameEn),
    searchVivinoBottleImage(itemNameEn).catch(() => null),
    getBrandContextForWine(itemCode).catch(() => null),
  ]);

  if (dbBrandContext) {
    logger.info(`[Claude] Using DB brand data for ${itemCode}: ${dbBrandContext.brandNameEn}`);
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
  if (dbBrandContext?.text) {
    brandContext = `\n\n=== 브랜드 자료실 DB 정보 ===\n${dbBrandContext.text}\n`;
  }

  // 컨텍스트 풍부도 판단: WS 또는 브랜드DB 있으면 web_search 불필요
  const hasRichContext = !!(wsData || dbBrandContext);

  // Step 2: Haiku 메인 조사 (컨텍스트 부족 시에만 web_search 추가)
  const vintageYear = parseVintage(vintage);
  const vintageInfo = vintageYear ? `\n빈티지: ${vintageYear}년` : '';
  const supplierInfo = supplier ? `\n생산자/브랜드: ${supplier}` : '';
  const supplierWarning = supplier ? `\n\n중요: 반드시 위 생산자(${supplier})의 와인을 조사하세요. 다른 생산자의 동명 와인을 혼동하지 마세요.` : '';
  const userMessage = `와인 이름(한글): ${itemNameKr}\n와인 이름(영문): ${itemNameEn}\n품번: ${itemCode}${vintageInfo}${supplierInfo}${wsContext}${brandContext}\n\n위 정보를 바탕으로 이 와인에 대해 조사해주세요.${wsData ? ' Wine-Searcher 데이터를 우선 사용하세요.' : ''}${dbBrandContext?.text ? ' 브랜드 DB 정보를 와이너리 소개와 양조에 활용하세요.' : ''}${vintageYear ? `\n\n중요: 빈티지 ${vintageYear}년의 기후, 작황에 대해 vintage_note에 구체적으로 작성해주세요.` : ''}${supplierWarning}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiParams: any = {
    model: RESEARCH_MODEL,
    max_tokens: 4096,
    // 고정 프롬프트는 system + cache_control로 분리 → 일괄 조사 시 입력 비용 절감
    // (tools→system 순으로 프리픽스가 캐시되므로 web_search 정의도 함께 캐시됨)
    system: [{ type: "text", text: RESEARCH_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: userMessage },
    ],
    // web_search 항상 허용: WS/브랜드DB는 메타데이터(이름·품종·산지)뿐이라
    // 실제 비평가 시음 평이 없음 → 관능 노트를 근거 기반으로 만들기 위해 검색 허용.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: hasRichContext ? 2 : 4 }],
  };

  const response = await client.messages.create(apiParams);
  logger.info(`[Claude] usage for ${itemCode}: cache_read=${response.usage?.cache_read_input_tokens ?? 0}, cache_write=${response.usage?.cache_creation_input_tokens ?? 0}, input=${response.usage?.input_tokens ?? 0}`);

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
  } catch {
    // 잘린 JSON 복구 시도
    try {
      let fixed = jsonStr;
      // 미완성 문자열 닫기
      if (fixed.match(/"[^"]*$/)) fixed += '"';
      // 닫히지 않은 중괄호/대괄호 보정
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
      result = JSON.parse(fixed) as WineResearchResult;
      logger.warn(`[Claude] JSON was truncated but recovered for ${itemCode}`);
    } catch (parseErr2) {
      logger.error(`[Claude] JSON parse failed. Raw text (first 500 chars): ${text.slice(0, 500)}`);
      throw new Error(`응답이 잘려 파싱에 실패했습니다. 재시도해주세요.`);
    }
  }

  // Step 3: 이미지 검색 (우선순위: 와이너리 공식사이트 → Vivino → Wine-Searcher)
  if (!imageUrl) {
    const searchNames = [
      itemNameEn,                          // 사용자 입력명 (최우선)
      result.item_name_en,                 // AI 조사명
    ].filter(Boolean) as string[];
    const uniqueNames = [...new Set(searchNames.map(n => n.toLowerCase()))];
    const nameMap = new Map(searchNames.map(n => [n.toLowerCase(), n]));

    // 3-1. 와이너리 공식 웹사이트에서 보틀 이미지 (가장 정확)
    if (dbBrandContext?.website) {
      imageUrl = await searchWineryWebsiteImage(
        itemNameEn, dbBrandContext.website, dbBrandContext.brandNameEn || undefined
      ).catch(() => null);
      if (imageUrl) {
        logger.info(`[Claude][WineImage] Found from winery site: ${dbBrandContext.website}`);
      }
    }

    // 3-2. Vivino 보틀샷
    if (!imageUrl) {
      for (const lowerName of uniqueNames) {
        const name = nameMap.get(lowerName) || lowerName;
        imageUrl = await searchVivinoBottleImage(name).catch(() => null);
        if (imageUrl) {
          logger.info(`[Claude][WineImage] Vivino: "${name}"`);
          break;
        }
      }
    }

    // 3-3. Wine-Searcher fallback
    if (!imageUrl) {
      for (const lowerName of uniqueNames) {
        const name = nameMap.get(lowerName) || lowerName;
        const wsRetry = await scrapeWineSearcher(name).catch(() => null);
        if (wsRetry?.imageUrl) {
          imageUrl = wsRetry.imageUrl;
          logger.info(`[Claude][WineImage] WS fallback: "${name}"`);
          break;
        }
      }
    }
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
    validation = await validateWineResult(itemNameKr, itemNameEn, result, supplier);
  }

  // verification_status 결정
  const verification_status: VerificationStatus =
    validation.confidence >= 80 ? 'verified' :
    validation.confidence >= 50 ? 'warning' : 'mismatch';

  logger.info(`[Claude] Wine research complete for ${itemCode} (WS: ${wsData ? 'yes' : 'no'}, brand: ${dbBrandContext ? 'DB' : 'no'}, image: ${imageUrl ? 'yes' : 'no'}, validation: ${validation.confidence}, status: ${verification_status})`);

  return { result, validation, verification_status };
}
