// 와인 이미지 검색 + Wine-Searcher 데이터 스크래핑 + Vivino 보틀샷 + 와이너리 공식사이트

import { logger } from "@/app/lib/logger";
import { getClaudeClient } from "@/app/lib/claudeClient";
import { isSafeFetchUrl } from "@/app/lib/validators";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/** Wine-Searcher에서 스크래핑한 와인 데이터 */
export interface WineSearcherData {
  name?: string;
  description?: string;
  imageUrl?: string;
  varietal?: string;
  region?: string;
  origin?: string;
  rating?: string;
  reviews?: string[];
}

/**
 * Vivino에서 와인 보틀 이미지 검색 (누키 PNG 보틀샷)
 * Vivino 프리로드 JSON에서 _pb_ (product bottle) PNG를 추출
 * 투명 배경의 풀 보틀샷이므로 PPT에 최적
 */
export async function searchVivinoBottleImage(wineNameEn: string): Promise<string | null> {
  if (!wineNameEn) return null;

  // 검색어 축약 전략: 전체→단어 줄여가며 시도
  const queries = [wineNameEn];
  const words = wineNameEn.split(/\s+/);
  if (words.length > 3) {
    // "Vincent Girardin Meursault Le Limozin" → "Vincent Girardin Meursault"
    queries.push(words.slice(0, Math.ceil(words.length * 0.6)).join(' '));
  }
  if (words.length > 2) {
    queries.push(words.slice(0, 3).join(' '));
  }

  for (const q of queries) {
    try {
      const res = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;

      const html = await res.text();

      // _pb_ = product bottle (누키 PNG 보틀샷)
      const pbMatch = html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_x960\.png/)
                    || html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_x600\.png/)
                    || html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_[A-Za-z0-9x]+\.png/);
      if (pbMatch) {
        const url = `https:${pbMatch[0]}`;
        logger.info(`[Vivino] Bottle cutout found (q="${q}"): ${url}`);
        return url;
      }

      // 라벨 이미지 fallback
      const plMatch = html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pl_480x640\.png/);
      if (plMatch) {
        const url = `https:${plMatch[0]}`;
        logger.info(`[Vivino] Label image fallback (q="${q}"): ${url}`);
        return url;
      }
    } catch {
      // 다음 쿼리 시도
    }
  }

  logger.warn(`[Vivino] No bottle image found for: ${wineNameEn}`);
  return null;
}

/**
 * Wine-Searcher에서 와인 정보 + 이미지 스크래핑
 * JSON-LD, meta 태그, OG 태그에서 데이터 추출
 */
export async function scrapeWineSearcher(wineNameEn: string): Promise<WineSearcherData | null> {
  if (!wineNameEn) return null;

  try {
    const query = encodeURIComponent(wineNameEn);
    const res = await fetch(`https://www.wine-searcher.com/find/${query}`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const data: WineSearcherData = {};

    // 1. JSON-LD 파싱 (가장 풍부한 데이터)
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1].trim());
        if (jsonLd.name) data.name = jsonLd.name;
        if (jsonLd.description) data.description = jsonLd.description;
        // 이미지는 Vivino 우선이므로 Wine-Searcher 이미지는 별도 저장하지 않음
        if (jsonLd.image) {
          const imgPath = typeof jsonLd.image === 'string' ? jsonLd.image : jsonLd.image?.url || jsonLd.image?.[0];
          if (imgPath) {
            data.imageUrl = imgPath.startsWith('http') ? imgPath : `https://www.wine-searcher.com${imgPath}`;
          }
        }
        // 리뷰 추출
        if (jsonLd.review && Array.isArray(jsonLd.review)) {
          data.reviews = jsonLd.review
            .map((r: { reviewBody?: string }) => r.reviewBody)
            .filter(Boolean)
            .slice(0, 3);
        }
      } catch { /* JSON parse error */ }
    }

    // 2. Meta 태그 (품종, 지역)
    const varietalMatch = html.match(/name="productVarietal"\s*content="([^"]+)"/i);
    if (varietalMatch) data.varietal = varietalMatch[1];

    const regionMatch = html.match(/name="productRegion"\s*content="([^"]+)"/i);
    if (regionMatch) data.region = regionMatch[1];

    const originMatch = html.match(/name="productOrigin"\s*content="([^"]+)"/i);
    if (originMatch) data.origin = originMatch[1];

    // 3. OG image (이미지 fallback)
    if (!data.imageUrl) {
      const ogImgMatch = html.match(/property="og:image"\s*content="([^"]+)"/i);
      if (ogImgMatch) data.imageUrl = ogImgMatch[1];
    }

    // 4. 라벨 이미지 fallback
    if (!data.imageUrl) {
      const labelMatch = html.match(/https:\/\/www\.wine-searcher\.com\/images\/labels\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i);
      if (labelMatch) data.imageUrl = labelMatch[0];
    }

    // 데이터가 있으면 반환
    if (data.name || data.varietal || data.imageUrl) {
      logger.info(`[WineSearcher] Found data for: ${wineNameEn}`, {
        name: data.name,
        varietal: data.varietal,
        hasImage: !!data.imageUrl,
      });
      return data;
    }

    return null;
  } catch (e) {
    logger.warn("[WineSearcher] Scraping failed", { error: e });
    return null;
  }
}

/**
 * 와인 보틀 이미지 검색 (Vivino 우선 → Wine-Searcher fallback)
 */
export async function searchWineImage(wineNameEn: string): Promise<string | null> {
  // 1순위: Vivino 풀 보틀샷
  const vivinoImage = await searchVivinoBottleImage(wineNameEn);
  if (vivinoImage) return vivinoImage;

  // 2순위: Wine-Searcher 이미지
  const wsData = await scrapeWineSearcher(wineNameEn);
  return wsData?.imageUrl || null;
}

/**
 * 와이너리 공식 웹사이트에서 와인 보틀 이미지 검색 (Claude Haiku + web_search)
 * 브랜드 자료실에 저장된 website URL을 활용하여 공식 제품 이미지를 우선 획득
 */
export async function searchWineryWebsiteImage(
  wineNameEn: string,
  websiteUrl: string,
  brandNameEn?: string
): Promise<string | null> {
  if (!wineNameEn || !websiteUrl) return null;

  try {
    // 도메인 추출 (site: 검색용)
    let domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!domain) return null;

    const client = getClaudeClient();
    const searchQuery = brandNameEn
      ? `${brandNameEn} ${wineNameEn} wine bottle`
      : `${wineNameEn} wine bottle`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 2 }],
      messages: [{
        role: "user",
        content: `Find the official product/bottle image URL for this wine from the winery's website.

Wine: ${wineNameEn}
Winery website: ${websiteUrl}
Domain: ${domain}

Search for this wine on the winery's official site (${domain}) and find the product page with a bottle image.

RULES:
- ONLY return image URLs from the winery's official domain (${domain}) or their CDN
- The image should be a wine bottle photo (not a logo, banner, or vineyard photo)
- Prefer PNG/JPG direct image URLs (ending in .jpg, .jpeg, .png, .webp)
- If you can't find an image from the official site, search "${searchQuery}" and find a reliable bottle image

Return ONLY a JSON object: {"image_url": "https://..."} or {"image_url": null} if not found.
No other text.`,
      }],
    });

    // 응답에서 텍스트 추출
    const texts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text' && 'text' in block) texts.push(block.text);
    }
    const text = texts.join('\n').replace(/<cite[^>]*>.*?<\/cite>/g, '').trim();
    if (!text) return null;

    // JSON 파싱
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    const imgUrl = parsed?.image_url;

    if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
      // SSRF 방어: LLM 이 반환한 URL을 그대로 fetch 하기 전 safety 검증
      if (!isSafeFetchUrl(imgUrl)) {
        logger.warn(`[WineryImage] Blocked unsafe URL: ${imgUrl}`);
        return null;
      }
      // 이미지 URL 유효성 검증 (HEAD 요청)
      try {
        const headRes = await fetch(imgUrl, { method: 'HEAD', headers: { "User-Agent": USER_AGENT } });
        const ct = headRes.headers.get('content-type') || '';
        if (headRes.ok && (ct.includes('image') || /\.(jpg|jpeg|png|webp)$/i.test(imgUrl))) {
          logger.info(`[WineryImage] Found bottle image from ${domain}: ${imgUrl}`);
          return imgUrl;
        }
      } catch {
        // HEAD 실패해도 URL 자체는 유효할 수 있음
        if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(imgUrl)) {
          logger.info(`[WineryImage] URL looks valid (skip HEAD): ${imgUrl}`);
          return imgUrl;
        }
      }
    }

    logger.info(`[WineryImage] No valid image found from ${domain} for ${wineNameEn}`);
    return null;
  } catch (e) {
    logger.warn(`[WineryImage] Failed for ${wineNameEn}`, { error: e });
    return null;
  }
}

/**
 * 이미지 URL에서 실제 이미지 데이터를 다운로드하여 base64로 반환
 */
export async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // SSRF 방어: DB wine.image_url 등 외부 제어 가능 경로
    if (!isSafeFetchUrl(imageUrl)) {
      logger.warn(`[WineImage] Blocked unsafe URL: ${imageUrl}`);
      return null;
    }
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString("base64");

    return { base64, mimeType: contentType.split(";")[0] };
  } catch (e) {
    logger.warn(`[WineImage] Failed to download image: ${imageUrl}`, { error: e });
    return null;
  }
}
