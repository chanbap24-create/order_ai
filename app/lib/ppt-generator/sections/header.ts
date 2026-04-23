import type PptxGenJS from "pptxgenjs";
import { LOGO_CAVEDEVIN_BASE64 } from "@/app/lib/pptAssets";
import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLine } from "../addPrimitives";

/**
 * 슬라이드 상단: 좌측 병 영역 배경 + 로고 + 태그라인 + 헤더 구분선 + 와인명 카드.
 */
export function renderHeader(slide: Slide, data: SlideData) {
  slide.background = { color: C.WHITE };

  // 1. 좌측 병 영역 배경 패널
  slide.addShape("rect", {
    x: 0, y: 0.9, w: 2.1, h: 8.1,
    fill: { color: C.BG_BOTTLE_AREA, transparency: 30 },
    line: { type: "none" },
  });

  // 2. HEADER 로고
  try {
    slide.addImage({
      data: "image/png;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.3, y: 0.14, w: 1.49, h: 0.57,
    });
  } catch { /* ignore */ }

  // 3. 와이너리 태그라인 (1줄로 제한)
  const wineryDesc = data.wineryDescription || "";
  if (wineryDesc) {
    let tagline = wineryDesc.split(".")[0].trim();
    if (!tagline) tagline = wineryDesc.split("。")[0].trim();
    if (tagline && tagline.length > 50) {
      tagline = tagline.substring(0, 48) + "…";
    }
    if (tagline) {
      slide.addText(tagline, {
        x: 2.2, y: 0.32, w: 5.0, h: 0.24,
        fontSize: 8, color: C.TEXT_MUTED,
        italic: true, fontFace: FONT_EN,
        autoFit: true,
      });
    }
  }

  // 4-5. 헤더 구분선 (골드 단선)
  addLine(slide, 0.2, 0.84, 7.1, C.GOLD, 1.5);

  // 6. 와인명 카드 배경
  slide.addShape("roundRect", {
    x: 2.2, y: 0.95, w: 5.05, h: 0.85,
    fill: { color: C.BURGUNDY_LIGHT, transparency: 40 },
    rectRadius: 0.06,
    line: { width: 0 },
  });

  // 좌측 와인명 포인트 바
  slide.addShape("rect", {
    x: 2.2, y: 0.99, w: 0.06, h: 0.77,
    fill: { color: C.BURGUNDY },
    line: { width: 0 },
  });

  // 7. 와인명 텍스트 (한글 + 영문) — 길이에 따라 폰트 자동 조절
  const nameKrClean = data.nameKr.replace(/^[A-Za-z]{2}\s+/, "");
  const totalLen = nameKrClean.length + (data.nameEn?.length || 0);
  const krFontSize = totalLen > 40 ? 13 : totalLen > 28 ? 14 : 17;
  const enFontSize = totalLen > 40 ? 8.5 : totalLen > 28 ? 9.5 : 11;

  const nameRuns: PptxGenJS.TextProps[] = [
    {
      text: data.nameEn ? nameKrClean + "\n" : nameKrClean,
      options: {
        fontSize: krFontSize, fontFace: FONT_MAIN,
        color: C.BURGUNDY_DARK, bold: true,
      },
    },
  ];
  if (data.nameEn) {
    nameRuns.push({
      text: data.nameEn,
      options: {
        fontSize: enFontSize, fontFace: FONT_EN,
        color: C.TEXT_SECONDARY, italic: true,
      },
    });
  }

  slide.addText(nameRuns, {
    x: 2.4, y: 0.98, w: 4.7, h: 0.8,
    valign: "middle", wrap: true, autoFit: true,
  });

  // 8. 와인명 하단 골드 구분선
  addLine(slide, 2.35, 1.88, 4.9, C.GOLD, 0.75);
}
