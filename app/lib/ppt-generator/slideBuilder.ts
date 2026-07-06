import sharp from "sharp";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { dataUrlToImage, downloadImageAsBase64, searchVivinoBottleImage, searchWineImageDuckDuckGo } from "@/app/lib/wineImageSearch";
import { getBrandContextForWine } from "@/app/lib/brandDb";
import { trimWhitespace } from "@/app/lib/logoTrim";
import { logger } from "@/app/lib/logger";
import { formatVintage4, type SlideData } from "./theme";

/** 브랜드 로고 다운로드 → 흰 여백 크롭 → base64 + 픽셀 크기. 실패 시 undefined. */
async function fetchBrandLogo(
  itemCode: string,
): Promise<{ base64: string; mime: string; w: number; h: number } | undefined> {
  try {
    const ctx = await getBrandContextForWine(itemCode);
    if (!ctx?.logoUrl) return undefined;
    // 자료실 로고가 data URL(base64 인라인)이면 SSRF 가드(http/https만 허용)에 막히므로 직접 디코드
    const img = ctx.logoUrl.startsWith("data:")
      ? dataUrlToImage(ctx.logoUrl)
      : await downloadImageAsBase64(ctx.logoUrl);
    if (!img) return undefined;
    // 로고 흰 여백 제거(작게 나오는 문제 해결)
    const trimmed = await trimWhitespace(img.base64);
    if (trimmed) return { base64: trimmed.base64, mime: "image/png", w: trimmed.w, h: trimmed.h };
    const m = await sharp(Buffer.from(img.base64, "base64")).metadata();
    if (!m.width || !m.height) return undefined;
    return { base64: img.base64, mime: img.mimeType, w: m.width, h: m.height };
  } catch {
    return undefined;
  }
}

/**
 * 병 이미지 전처리: 주변 여백(흰/투명 패딩)을 잘라내(trim) 병이 영역을 꽉 채우게,
 * PNG로 변환 후 트림된 실제 픽셀 크기 반환. 실패 시 undefined.
 */
async function prepBottle(base64: string): Promise<{ base64: string; w: number; h: number } | undefined> {
  try {
    const trimmed = await sharp(Buffer.from(base64, "base64")).trim({ threshold: 10 }).png().toBuffer();
    const m = await sharp(trimmed).metadata();
    if (m.width && m.height) return { base64: trimmed.toString("base64"), w: m.width, h: m.height };
  } catch { /* ignore */ }
  return undefined;
}

/**
 * wineId 리스트로부터 SlideData 배열을 구축.
 * 병 이미지는 DB image_url 우선, 실패 시 Vivino 검색 fallback.
 */
export async function buildSlidesFromWineIds(wineIds: string[]): Promise<SlideData[]> {
  const slides: SlideData[] = [];

  for (const wineId of wineIds) {
    const wine = await getWineByCode(wineId);
    if (!wine) continue;

    const note = await getTastingNote(wineId);
    const logo = await fetchBrandLogo(wineId);
    const brandCtx = await getBrandContextForWine(wineId).catch(() => null); // 상단 와이너리명에 브랜드명 사용

    let bottleImageBase64: string | undefined;
    let bottleImageMimeType: string | undefined;
    let bottleImageW: number | undefined;
    let bottleImageH: number | undefined;

    if (wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          const prepped = await prepBottle(imgData.base64);
          if (prepped) {
            bottleImageBase64 = prepped.base64;
            bottleImageMimeType = "image/png";
            bottleImageW = prepped.w;
            bottleImageH = prepped.h;
          } else {
            bottleImageBase64 = imgData.base64;
            bottleImageMimeType = imgData.mimeType;
          }
          logger.info(`[PPT] DB image for ${wineId}`);
        }
      } catch {
        logger.warn(`[PPT] Image download failed for ${wineId}`);
      }
    }

    // 지정 image_url이 있으면 위에서 우선 사용됨. 다운로드 실패(핫링크 차단 등)했으면 검색으로 보완
    // — 단 빈티지를 넘겨 '올바른 빈티지' 병샷을 찾게 한다(무통처럼 빈티지별 라벨 대응).
    if (!bottleImageBase64) {
      const engName = wine.item_name_en;
      if (engName) {
        try {
          const vin = formatVintage4(wine.vintage || "");
          const vivinoUrl = await searchWineImageDuckDuckGo(engName, undefined, vin).catch(() => null) || await searchVivinoBottleImage(engName);
          if (vivinoUrl) {
            const imgData = await downloadImageAsBase64(vivinoUrl);
            if (imgData) {
              const prepped = await prepBottle(imgData.base64);
              if (prepped) {
                bottleImageBase64 = prepped.base64;
                bottleImageMimeType = "image/png";
                bottleImageW = prepped.w;
                bottleImageH = prepped.h;
              } else {
                bottleImageBase64 = imgData.base64;
                bottleImageMimeType = imgData.mimeType;
              }
              logger.info(`[PPT] Vivino nukki image for ${wineId}`);
            }
          }
        } catch {
          logger.warn(`[PPT] Vivino search failed for ${wineId}`);
        }
      }
    }

    slides.push({
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || "",
      wineryNameEn: brandCtx?.brandNameEn || "",
      country: wine.country || "",
      countryEn: wine.country_en || "",
      region: wine.region || "",
      grapeVarieties: wine.grape_varieties || "",
      vintage: formatVintage4(wine.vintage || ""),
      vintageNote: note?.vintage_note || "",
      wineryDescription: note?.winery_description || "",
      winemaking: note?.winemaking || "",
      alcoholPercentage: wine.alcohol || "",
      agingPotential: note?.aging_potential || "",
      colorNote: note?.color_note || "",
      noseNote: note?.nose_note || "",
      palateNote: note?.palate_note || "",
      foodPairing: note?.food_pairing || "",
      glassPairing: note?.glass_pairing || "",
      servingTemp: note?.serving_temp || "",
      awards: note?.awards || "",
      bottleImageBase64,
      bottleImageMimeType,
      bottleImageW,
      bottleImageH,
      brandLogoBase64: logo?.base64,
      brandLogoMimeType: logo?.mime,
      brandLogoW: logo?.w,
      brandLogoH: logo?.h,
    });
  }

  return slides;
}
