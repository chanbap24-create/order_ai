import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";
import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLine } from "../addPrimitives";
import { cleanAwards, capChars } from "@/app/lib/wineNoteText";

/**
 * 수상내역(선택), 푸터(로고 + 회사 정보), 병 이미지(선택).
 */
export function renderFooter(slide: Slide, data: SlideData) {
  // 수상내역 상단선
  addLine(slide, 0.3, 9.05, 6.9, C.GOLD_LIGHT, 0.5);

  const awards = capChars(cleanAwards(data.awards), 130);
  if (awards) {
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

  // Footer 로고 — 구분선(9.5)~슬라이드 바닥(10.0) 밴드에 세로 중앙 배치.
  // 기존엔 박스가 바닥에 붙어 위아래 여백이 달랐음. 로고 원본 비율(1812×570)로 정확히 그림.
  const FOOTER_TOP = 9.5, FOOTER_H = 0.5;
  const LOGO_H = 0.34, LOGO_W = LOGO_H * (1812 / 570);
  try {
    slide.addImage({
      data: "image/png;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.3, y: FOOTER_TOP + (FOOTER_H - LOGO_H) / 2, w: LOGO_W, h: LOGO_H,
    });
  } catch { /* ignore */ }

  // 회사 정보 (우측 정렬, 로고와 같은 밴드에 세로 중앙)
  slide.addText("T. 02-786-3136  |  www.cavedevin.com", {
    x: 4.2, y: FOOTER_TOP, w: 3.0, h: FOOTER_H,
    fontSize: 7.5, fontFace: FONT_EN,
    color: C.TEXT_MUTED,
    align: "right", valign: "middle",
  });

  // 병 이미지 (있을 때만) — 원본 비율대로 좌측 영역에 맞춰 배치(강제 변형 X).
  if (data.bottleImageBase64 && data.bottleImageMimeType) {
    try {
      // 가용 영역(좌측 패널 내부)
      const AREA_X = 0.15, AREA_Y = 1.95, AREA_W = 1.9, AREA_H = 6.8;
      // 원본 비율(없으면 일반 와인병 비율 가정)
      const imgW = data.bottleImageW || 1;
      const imgH = data.bottleImageH || 3.2;
      const scale = Math.min(AREA_W / imgW, AREA_H / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      const x = AREA_X + (AREA_W - w) / 2; // 가로 중앙
      const y = AREA_Y + (AREA_H - h) / 2; // 세로 중앙
      slide.addImage({
        data: `${data.bottleImageMimeType};base64,${data.bottleImageBase64}`,
        x, y, w, h,
      });
    } catch (e) {
      logger.warn(`[PPT] Failed to add bottle image: ${e}`);
    }
  }
}
