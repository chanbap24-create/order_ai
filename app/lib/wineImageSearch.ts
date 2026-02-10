// 와인 병 이미지 자동 검색
// Wine-Searcher에서 와인 라벨/병 이미지를 검색

import { logger } from "@/app/lib/logger";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Wine-Searcher에서 와인 이미지 URL 검색
 */
async function searchWineSearcher(wineNameEn: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(wineNameEn);
    const res = await fetch(`https://www.wine-searcher.com/find/${query}`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Wine-Searcher 라벨 이미지 패턴
    const labelMatch = html.match(
      /https:\/\/www\.wine-searcher\.com\/images\/labels\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i
    );
    if (labelMatch) return labelMatch[0];

    // 대체: 와인 이미지 패턴
    const imgMatch = html.match(
      /https:\/\/[^"'\s]*wine-searcher[^"'\s]*\/images\/[^"'\s]*\.(?:jpg|jpeg|png|webp)/i
    );
    if (imgMatch) return imgMatch[0];

    return null;
  } catch (e) {
    logger.warn("[WineImage] Wine-Searcher search failed", { error: e });
    return null;
  }
}

/**
 * Google Images에서 와인 병 이미지 URL 검색 (fallback)
 */
async function searchGoogleImages(wineNameEn: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${wineNameEn} wine bottle`);
    const res = await fetch(
      `https://www.google.com/search?q=${query}&tbm=isch&safe=active`,
      { headers: { "User-Agent": USER_AGENT } }
    );

    if (!res.ok) return null;

    const html = await res.text();

    // Google Images에서 외부 이미지 URL 추출
    const matches = html.match(
      /https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi
    );

    if (!matches) return null;

    // Google 자체 이미지나 아이콘은 제외, 실제 와인 이미지만 필터
    const filtered = matches.filter(
      (url) =>
        !url.includes("google.com") &&
        !url.includes("gstatic.com") &&
        !url.includes("googleapis.com") &&
        !url.includes("favicon") &&
        !url.includes("icon") &&
        url.length > 50
    );

    return filtered[0] || null;
  } catch (e) {
    logger.warn("[WineImage] Google image search failed", { error: e });
    return null;
  }
}

/**
 * 와인 이미지 URL 검색 (여러 소스 시도)
 */
export async function searchWineImage(wineNameEn: string): Promise<string | null> {
  if (!wineNameEn) return null;

  logger.info(`[WineImage] Searching image for: ${wineNameEn}`);

  // 1. Wine-Searcher
  const wsUrl = await searchWineSearcher(wineNameEn);
  if (wsUrl) {
    logger.info(`[WineImage] Found via Wine-Searcher: ${wsUrl}`);
    return wsUrl;
  }

  // 2. Google Images (fallback)
  const googleUrl = await searchGoogleImages(wineNameEn);
  if (googleUrl) {
    logger.info(`[WineImage] Found via Google: ${googleUrl}`);
    return googleUrl;
  }

  logger.warn(`[WineImage] No image found for: ${wineNameEn}`);
  return null;
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
