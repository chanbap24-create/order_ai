import type PptxGenJS from "pptxgenjs";
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

  // 2-3. 헤더: 와이너리 로고(병과 중앙정렬) + 이름/원산지(우측 콘텐츠 시작점 정렬). 까브드뱅 로고는 푸터에만.
  const hasLogo = !!(data.brandLogoBase64 && data.brandLogoMimeType && data.brandLogoW && data.brandLogoH);
  const wName = extractWineryNameEn(data.wineryDescription, data.nameEn);
  const hCountry = data.countryEn || data.country || "";
  const hSub = data.region ? `${data.region}, ${hCountry}` : hCountry;

  const BOTTLE_CENTER = 1.1; // 좌측 병 영역 중심 (footer.ts AREA_X 0.15 + AREA_W 1.9 / 2)
  const CONTENT_X = 2.2;     // 우측 콘텐츠(와인명 카드/배지) 시작 x

  if (hasLogo) {
    // 로고 바운딩 박스: 병 컬럼(폭 1.9) 대비 사방 여백을 두어 답답함 완화. 비율은 아래 Math.min이 유지.
    const MAX_W = 1.7, MAX_H = 0.6, BAND_Y = 0.04, BAND_H = 0.78;
    const scale = Math.min(MAX_W / data.brandLogoW!, MAX_H / data.brandLogoH!);
    const w = data.brandLogoW! * scale, h = data.brandLogoH! * scale;
    try {
      slide.addImage({
        data: `${data.brandLogoMimeType};base64,${data.brandLogoBase64}`,
        x: BOTTLE_CENTER - w / 2, y: BAND_Y + (BAND_H - h) / 2, w, h, // 병과 가로 중앙정렬
      });
    } catch { /* ignore */ }
  }

  const textX = CONTENT_X; // 이름은 항상 우측 콘텐츠 시작점에 맞춤
  if (wName) {
    slide.addText(wName, {
      x: textX, y: 0.13, w: 7.2 - textX, h: 0.36,
      fontSize: 20, fontFace: FONT_EN, color: C.BURGUNDY, italic: true, align: "left", valign: "middle",
    });
    if (hSub) {
      slide.addText(hSub, {
        x: textX, y: 0.5, w: 7.2 - textX, h: 0.2,
        fontSize: 9, fontFace: FONT_EN, color: C.TEXT_MUTED, align: "left", valign: "middle",
      });
    }
  } else if (hSub) {
    slide.addText(hSub, {
      x: textX, y: 0.28, w: 7.2 - textX, h: 0.35,
      fontSize: 14, fontFace: FONT_EN, color: C.BURGUNDY, align: "left", valign: "middle",
    });
  }

  // 4-5. 헤더 구분선 (골드 단선)
  addLine(slide, 0.2, 0.84, 7.1, C.GOLD, 1.5);

  // 6. 와인명 카드: 배경 쉐이드 없이 좌측 포인트 바만
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
