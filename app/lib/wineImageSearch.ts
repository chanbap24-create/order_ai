// 와인 이미지 검색 + Wine-Searcher 데이터 스크래핑

import { logger } from "@/app/lib/logger";

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
 * 와인 이미지 URL만 검색 (간단 버전)
 */
export async function searchWineImage(wineNameEn: string): Promise<string | null> {
  const data = await scrapeWineSearcher(wineNameEn);
  return data?.imageUrl || null;
}

/**
 * 이미지 URL에서 실제 이미지 데이터를 다운로드하여 base64로 반환
 */
export async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
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
