import sharp from "sharp";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { getBrandContextForWine } from "@/app/lib/brandDb";
import { formatVintage4, type SlideData } from "./theme";

/** 브랜드 로고 다운로드 → PNG(PDFKit 호환) base64 + 원본 크기. 실패 시 undefined. */
async function fetchBrandLogo(
  itemCode: string,
): Promise<{ base64: string; w: number; h: number } | undefined> {
  try {
    const ctx = await getBrandContextForWine(itemCode);
    if (!ctx?.logoUrl) return undefined;
    const img = await downloadImageAsBase64(ctx.logoUrl);
    if (!img) return undefined;
    const png = await sharp(Buffer.from(img.base64, "base64")).png().toBuffer();
    const m = await sharp(png).metadata();
    if (!m.width || !m.height) return undefined;
    return { base64: png.toString("base64"), w: m.width, h: m.height };
  } catch {
    return undefined;
  }
}

/**
 * PDFKit은 PNG/JPEG만 지원(webp/avif 등은 'Unknown image format' 에러).
 * 지원 안 되는 포맷이면 sharp로 PNG 변환.
 */
async function toPdfSafeImage(
  base64: string,
  mime: string,
): Promise<{ base64: string; mime: string }> {
  // 주변 여백 trim(병이 영역을 꽉 채우게) + PDFKit 호환 PNG 변환.
  try {
    const png = await sharp(Buffer.from(base64, "base64")).trim({ threshold: 10 }).png().toBuffer();
    return { base64: png.toString("base64"), mime: "image/png" };
  } catch {
    return { base64, mime };
  }
}

/**
 * wineId 리스트로부터 렌더링용 SlideData 배열을 구축.
 * 병 이미지는 DB image_url 우선, 실패 시 Vivino 검색 fallback.
 */
export async function buildSlidesFromWineIds(wineIds: string[]): Promise<SlideData[]> {
  const slides: SlideData[] = [];

  for (const wineId of wineIds) {
    const wine = await getWineByCode(wineId);
    if (!wine) continue;

    const note = await getTastingNote(wineId);
    const logo = await fetchBrandLogo(wineId);

    let bottleImageBase64: string | undefined;
    let bottleImageMimeType: string | undefined;
    let bottleCropBottom = false; // Vivino 하단 워터마크
    let bottleCropRight = false;  // Wine-Searcher 우측 상단 워터마크

    // 소스 URL 로 워터마크 위치 감지 (깨끗한 소스는 크롭 안 함).
    const detectWatermark = (url: string) => {
      const u = url.toLowerCase();
      if (u.includes("vivino")) bottleCropBottom = true;
      if (u.includes("wine-searcher") || u.includes("winesearcher")) bottleCropRight = true;
    };

    // 1순위: DB에 저장된 image_url (관리자 수정 가능)
    if (wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          const safe = await toPdfSafeImage(imgData.base64, imgData.mimeType);
          bottleImageBase64 = safe.base64;
          bottleImageMimeType = safe.mime;
          detectWatermark(wine.image_url);
        }
      } catch { /* ignore */ }
    }

    // 2순위: Vivino 누끼 보틀샷 검색
    if (!bottleImageBase64) {
      const engName = wine.item_name_en;
      if (engName) {
        try {
          const vivinoUrl = await searchVivinoBottleImage(engName);
          if (vivinoUrl) {
            const imgData = await downloadImageAsBase64(vivinoUrl);
            if (imgData) {
              const safe = await toPdfSafeImage(imgData.base64, imgData.mimeType);
              bottleImageBase64 = safe.base64;
              bottleImageMimeType = safe.mime;
              bottleCropBottom = true; // Vivino fallback → 하단 워터마크
            }
          }
        } catch { /* ignore */ }
      }
    }

    slides.push({
      bottleCropBottom,
      bottleCropRight,
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
      brandLogoBase64: logo?.base64,
      brandLogoW: logo?.w,
      brandLogoH: logo?.h,
    });
  }

  return slides;
}
