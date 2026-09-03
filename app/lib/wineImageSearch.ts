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

// Vivino 보틀샷 검색은 이름 일치 검증 포함 버전으로 분리 (기존 import 경로 호환용 재export)
export { searchVivinoBottleImage } from "@/app/lib/vivinoImageSearch";
import { searchVivinoBottleImage, nameMatches } from "@/app/lib/vivinoImageSearch";

/** HEAD로 이미지 URL 유효성 확인(콘텐츠타입 image 또는 이미지 확장자). 실패해도 확장자 맞으면 통과. */
async function headOkImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
    const ct = res.headers.get("content-type") || "";
    if (res.ok && (ct.includes("image") || /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url))) return true;
  } catch { /* HEAD 실패 시 확장자로 판단 */ }
  return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url);
}

interface DdgImage { image: string; title: string; width: number; height: number; }

/** DuckDuckGo 이미지 검색(JSON). vqd 토큰 획득 후 i.js 호출. 키 불필요. */
async function ddgImageResults(query: string): Promise<DdgImage[]> {
  try {
    const tok = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
      headers: { "User-Agent": USER_AGENT },
    });
    const html = await tok.text();
    const vqd = (html.match(/vqd="?([\d-]+)"?/) || [])[1];
    if (!vqd) return [];
    const res = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`, {
      headers: { "User-Agent": USER_AGENT, Referer: "https://duckduckgo.com/", Accept: "application/json" },
    });
    if (!res.ok) return [];
    const j = await res.json().catch(() => null);
    return ((j?.results || []) as Array<Record<string, unknown>>).map((x) => ({
      image: String(x.image || ""),
      title: String(x.title || ""),
      width: Number(x.width) || 0,
      height: Number(x.height) || 0,
    }));
  } catch {
    return [];
  }
}

/** 한 쿼리로 DDG 검색 → 이름일치·병모양 스코어 최상위 보틀샷 URL 반환. */
async function pickBottleFromDdg(query: string, matchName: string): Promise<string | null> {
  const results = await ddgImageResults(query);
  if (!results.length) return null;
  // 이름 일치 후보만(오인 방지). matchName에 빈티지 포함 시 nameMatches가 연도까지 강제.
  const matched = results.filter((r) => r.title && nameMatches(matchName, r.title));
  if (!matched.length) {
    logger.info(`[DDG] ${results.length} images but no name match: "${matchName}"`);
    return null;
  }
  // 병샷 스코어: 세로형(높이/너비) 우선 + 적정 해상도 + 누끼 png 가점
  const scored = matched
    .filter((r) => r.image && r.width >= 200 && r.height >= 200)
    .map((r) => {
      const portrait = r.height / Math.max(1, r.width);
      let s = 0;
      if (portrait >= 1.5) s += 4;        // 병은 확실히 세로로 김
      else if (portrait >= 1.15) s += 2;
      else if (portrait < 0.9) s -= 3;    // 가로형 = 라벨크롭/배너 감점
      if (/\.png(\?|$)/i.test(r.image)) s += 1;
      return { r, s };
    })
    .sort((a, b) => b.s - a.s);
  for (const { r } of scored) {
    if (isSafeFetchUrl(r.image) && (await headOkImage(r.image))) {
      logger.info(`[DDG] Matched "${r.title}" (${r.width}x${r.height}): ${r.image}`);
      return r.image;
    }
  }
  return null;
}

/**
 * DuckDuckGo 이미지에서 와인 보틀샷 검색 (Vivino/Wine-Searcher 스크래핑 대체 주 소스).
 * 빈티지(4자리)가 있으면 빈티지 포함으로 먼저 시도(무통처럼 빈티지별 라벨 대응) → 없으면 빈티지 무시 폴백.
 * 이름 일치 후보 중 '세로형(병 모양)' + 적정 해상도를 우선 선택. 잘못된 병보다 없는 게 나음.
 */
export async function searchWineImageDuckDuckGo(
  wineNameEn: string,
  brandNameEn?: string,
  vintage?: string,
): Promise<string | null> {
  if (!wineNameEn) return null;
  const brand = brandNameEn ? `${brandNameEn} ` : "";
  const v = vintage && /^\d{4}$/.test(vintage.trim()) ? vintage.trim() : "";
  const attempts = v
    ? [
        { q: `${brand}${wineNameEn} ${v} wine bottle`, m: `${wineNameEn} ${v}` }, // 빈티지 일치 우선
        { q: `${brand}${wineNameEn} wine bottle`, m: wineNameEn },                 // 폴백: 빈티지 무시
      ]
    : [{ q: `${brand}${wineNameEn} wine bottle`, m: wineNameEn }];
  for (const a of attempts) {
    const url = await pickBottleFromDdg(a.q, a.m);
    if (url) return url;
  }
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
    const domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
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
/**
 * data:image/...;base64,xxx URL을 파싱해 base64 + mime 반환. 비-data URL/형식 불일치 시 null.
 * 어드민 자료실 로고가 data URL로 저장된 경우(SSRF 가드가 http/https만 허용해 막는 케이스)
 * fetch 없이 직접 디코드하기 위함.
 */
export function dataUrlToImage(url: string): { base64: string; mimeType: string } | null {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const mimeType = (m[1] || "image/png").split(";")[0];
  const base64 = m[2] ? m[3] : Buffer.from(decodeURIComponent(m[3])).toString("base64");
  if (!base64) return null;
  return { base64, mimeType };
}

export async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  // data: URL은 직접 디코드(SSRF 가드가 http/https만 허용)
  if (imageUrl.startsWith("data:")) return dataUrlToImage(imageUrl);
  // SSRF 방어: DB wine.image_url 등 외부 제어 가능 경로
  if (!isSafeFetchUrl(imageUrl)) {
    logger.warn(`[WineImage] Blocked unsafe URL: ${imageUrl}`);
    return null;
  }
  let referer = "";
  try { referer = new URL(imageUrl).origin + "/"; } catch { /* invalid url */ }
  // 두 전략을 순서대로 시도:
  //  1) 단순 UA(Referer 없음) — robertoatley 등 Referer에 403 내는 사이트 대응
  //  2) 풀 브라우저 헤더 + 출처 Referer — 핫링크 차단(대부분 리테일러/CDN) 대응
  const strategies: Array<Record<string, string>> = [
    { "User-Agent": USER_AGENT },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(referer ? { Referer: referer } : {}),
    },
  ];
  let lastStatus = 0;
  for (const headers of strategies) {
    try {
      // 타임아웃 필수 — 응답 없이 매달리는 호스트(예: premiumport.com)가 있으면
      // 브랜드북 등 일괄 임베드 작업 전체가 서버 상한(300s)까지 멈춘다
      const res = await fetch(imageUrl, { headers, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) { lastStatus = res.status; continue; }
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.includes("image")) { lastStatus = -1; continue; } // 403 HTML 등 방어
      const buffer = Buffer.from(await res.arrayBuffer());
      return { base64: buffer.toString("base64"), mimeType: contentType.split(";")[0] };
    } catch { /* 다음 전략 */ }
  }
  logger.warn(`[WineImage] Download failed (${lastStatus || "err"}) for ${imageUrl}`);
  return null;
}
