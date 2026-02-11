// 와인 이미지 검색 + Wine-Searcher 데이터 스크래핑 + Vivino 보틀샷

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
