import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";
import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLine } from "../addPrimitives";

/**
 * 수상내역(선택), 푸터(로고 + 회사 정보), 병 이미지(선택).
 */
export function renderFooter(slide: Slide, data: SlideData) {
  // 수상내역 상단선
  addLine(slide, 0.3, 9.05, 6.9, C.GOLD_LIGHT, 0.5);

  const awards = data.awards || "";
  if (awards && awards !== "N/A") {
    const AWARD_Y = 9.12;
    const AWARD_H = 0.32;

    try {
      slide.addImage({
        data: "image/jpeg;base64," + ICON_AWARD_BASE64,
        x: 0.3, y: AWARD_Y + 0.04, w: 0.2, h: 0.24,
      });
    } catch { /* ignore */ }

    slide.addText("AWARDS", {
      x: 0.54, y: AWARD_Y, w: 0.9, h: AWARD_H,
      fontSize: 7.5, fontFace: FONT_EN,
      color: C.BURGUNDY, bold: true,
      charSpacing: 1.5, valign: "middle",
    });

    slide.addText(awards, {
      x: 1.45, y: AWARD_Y, w: 5.7, h: AWARD_H,
      fontSize: 8.5, fontFace: FONT_MAIN,
      color: C.TEXT_PRIMARY, lineSpacing: 12,
      wrap: true, autoFit: true, valign: "middle",
    });
  }

  // FOOTER
  addLine(slide, 0.3, 9.5, 6.9, C.GOLD, 1.0);

  // Footer 로고
  try {
    slide.addImage({
      data: "image/png;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.3, y: 9.58, w: 1.1, h: 0.42,
      sizing: { type: "contain", w: 1.1, h: 0.42 },
    });
  } catch { /* ignore */ }

  // 회사 정보 (우측 정렬)
  slide.addText("T. 02-786-3136  |  www.cavedevin.com", {
    x: 4.2, y: 9.62, w: 3.0, h: 0.3,
    fontSize: 7.5, fontFace: FONT_EN,
    color: C.TEXT_MUTED,
    align: "right", valign: "middle",
  });

  // 병 이미지 (있을 때만)
  if (data.bottleImageBase64 && data.bottleImageMimeType) {
    try {
      slide.addImage({
        data: `${data.bottleImageMimeType};base64,${data.bottleImageBase64}`,
        x: 0.25, y: 2.0, w: 1.6, h: 6.6,
        sizing: { type: "contain", w: 1.6, h: 6.6 },
      });
    } catch (e) {
      logger.warn(`[PPT] Failed to add bottle image: ${e}`);
    }
  }
}
