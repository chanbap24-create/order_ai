import sharp from "sharp";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { logger } from "@/app/lib/logger";
import { formatVintage4, type SlideData } from "./theme";

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

    if (!bottleImageBase64) {
      const engName = wine.item_name_en;
      if (engName) {
        try {
          const vivinoUrl = await searchVivinoBottleImage(engName);
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
    });
  }

  return slides;
}
