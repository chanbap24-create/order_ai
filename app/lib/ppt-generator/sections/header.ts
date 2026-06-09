import type PptxGenJS from "pptxgenjs";
import { LOGO_CAVEDEVIN_BASE64 } from "@/app/lib/pptAssets";
import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLine } from "../addPrimitives";
import { extractWineryNameEn, stripCodePrefix } from "@/app/lib/wineNoteText";

/**
 * 슬라이드 상단: 좌측 병 영역 배경 + 로고 + 태그라인 + 헤더 구분선 + 와인명 카드.
 */
export function renderHeader(slide: Slide, data: SlideData) {
  slide.background = { color: C.WHITE };

  // 1. 좌측 병 영역 배경: 흰색(병 이미지가 누끼가 아니라 흰 박스 배경이어도 자연스럽게)
  slide.addShape("rect", {
    x: 0, y: 0.9, w: 2.1, h: 8.1,
    fill: { color: C.WHITE },
    line: { type: "none" },
  });

  // 2. HEADER 로고
  try {
    slide.addImage({
      data: "image/png;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.3, y: 0.14, w: 1.49, h: 0.57,
    });
  } catch { /* ignore */ }

  // 3. 헤더 우측: 와이너리 로고(있으면) 또는 와이너리명 + 원산지
  if (data.brandLogoBase64 && data.brandLogoMimeType && data.brandLogoW && data.brandLogoH) {
    // 로고를 우측 정렬, 헤더 높이에 맞춰 비율 보존
    const AREA_R = 7.2, MAX_W = 2.6, MAX_H = 0.58, AREA_Y = 0.1, AREA_H = 0.66;
    const scale = Math.min(MAX_W / data.brandLogoW, MAX_H / data.brandLogoH);
    const w = data.brandLogoW * scale, h = data.brandLogoH * scale;
    try {
      slide.addImage({
        data: `${data.brandLogoMimeType};base64,${data.brandLogoBase64}`,
        x: AREA_R - w, y: AREA_Y + (AREA_H - h) / 2, w, h,
      });
    } catch { /* ignore */ }
  } else {
    const wName = extractWineryNameEn(data.wineryDescription, data.nameEn);
    const hCountry = data.countryEn || data.country || "";
    const hSub = data.region ? `${data.region}, ${hCountry}` : hCountry;
    if (wName) {
      slide.addText(wName, {
        x: 1.9, y: 0.15, w: 5.3, h: 0.42,
        fontSize: 19, fontFace: FONT_EN, color: C.BURGUNDY,
        italic: true, align: "right", valign: "middle",
      });
      if (hSub) {
        slide.addText(hSub, {
          x: 1.9, y: 0.55, w: 5.3, h: 0.22,
          fontSize: 9, fontFace: FONT_EN, color: C.TEXT_MUTED,
          align: "right", valign: "middle",
        });
      }
    } else if (hSub) {
      slide.addText(hSub, {
        x: 1.9, y: 0.28, w: 5.3, h: 0.35,
        fontSize: 13, fontFace: FONT_EN, color: C.BURGUNDY,
        align: "right", valign: "middle",
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

  // 7. 와인명 텍스트 (한글 + 영문) — 전산 검색용 2글자 코드 제거 후, 길이에 따라 폰트 자동 조절
  const nameKrClean = stripCodePrefix(data.nameKr);
  const nameEnClean = stripCodePrefix(data.nameEn);
  const totalLen = nameKrClean.length + nameEnClean.length;
  const krFontSize = totalLen > 40 ? 13 : totalLen > 28 ? 14 : 17;
  const enFontSize = totalLen > 40 ? 8.5 : totalLen > 28 ? 9.5 : 11;

  const nameRuns: PptxGenJS.TextProps[] = [
    {
      text: nameEnClean ? nameKrClean + "\n" : nameKrClean,
      options: {
        fontSize: krFontSize, fontFace: FONT_MAIN,
        color: C.BURGUNDY_DARK, bold: true,
      },
    },
  ];
  if (nameEnClean) {
    nameRuns.push({
      text: nameEnClean,
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
