import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { formatVintage4, type SlideData } from "./theme";

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
          bottleImageBase64 = imgData.base64;
          bottleImageMimeType = imgData.mimeType;
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
              bottleImageBase64 = imgData.base64;
              bottleImageMimeType = imgData.mimeType;
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
    });
  }

  return slides;
}
