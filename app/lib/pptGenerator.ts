// PPT 생성기 - pptxgenjs 기반 (Vercel 서버리스 호환)
// python-pptx (child_process) → pptxgenjs (pure JS) 마이그레이션

import PptxGenJS from "pptxgenjs";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { embedFontsInPptx } from "@/app/lib/pptFontEmbed";
import { logger } from "@/app/lib/logger";

// ═══════════════════════════════════════════════════
// 와인 테마 컬러 팔레트
// ═══════════════════════════════════════════════════
const C = {
  BG_BOTTLE_AREA: "F5F0EA",
  BG_WARM_GRAY: "F8F6F4",
  BURGUNDY: "722F37",
  BURGUNDY_DARK: "5A252C",
  BURGUNDY_LIGHT: "F2E8EA",
  WINE_ACCENT: "5A1515",
  HEADER_DARK_L: "3A0C0C",
  HEADER_DARK_R: "5A1515",
  GOLD: "B8976A",
  GOLD_LIGHT: "D4C4A8",
  TEXT_PRIMARY: "2C2C2C",
  TEXT_SECONDARY: "5A5A5A",
  TEXT_MUTED: "8A8A8A",
  TEXT_ON_DARK: "FFFFFF",
  CARD_BORDER: "E0D5C8",
  DIVIDER: "D4C4A8",
  DIVIDER_LIGHT: "E8DDD0",
  SEPARATOR: "E5E5E5",
  SHADOW: "D0D0D0",
  WHITE: "FFFFFF",
};

const FONT_MAIN = "Gowun Dodum";
const FONT_EN = "Georgia";

// 슬라이드 크기 (인치) - 세로 A4
const SLIDE_W = 7.5;
const SLIDE_H = 10.0;

// ─── 헬퍼: 빈티지 2자리→4자리 변환 ───
function formatVintage4(v: string): string {
  if (!v || v === "-") return "-";
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) {
    return num >= 50
      ? `19${String(num).padStart(2, "0")}`
      : `20${String(num).padStart(2, "0")}`;
  }
  return v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slide = any;

// ─── 수평선 추가 ───
function addLine(
  slide: Slide,
  x: number,
  y: number,
  w: number,
  color: string,
  widthPt: number = 0.75
) {
  slide.addShape("line", {
    x,
    y,
    w,
    h: 0,
    line: { color, width: widthPt },
  });
}

// ─── 세로선 추가 ───
function addVLine(
  slide: Slide,
  x: number,
  yStart: number,
  yEnd: number,
  color: string,
  widthPt: number = 0.75
) {
  slide.addShape("line", {
    x,
    y: yStart,
    w: 0,
    h: yEnd - yStart,
    line: { color, width: widthPt },
  });
}

// ─── 라벨 뱃지 (버건디 배경 둥근 사각형 + 흰 텍스트) ───
function addLabelBadge(
  slide: Slide,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number = 0.22
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    fill: { color: C.BURGUNDY },
    rectRadius: 0.05,
    line: { width: 0 },
  });
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontSize: 8.5,
    fontFace: FONT_MAIN,
    color: C.TEXT_ON_DARK,
    bold: true,
    align: "center",
    valign: "middle",
  });
}

// ─── 슬라이드 데이터 인터페이스 ───
interface SlideData {
  nameKr: string;
  nameEn: string;
  country: string;
  countryEn: string;
  region: string;
  grapeVarieties: string;
  vintage: string;
  vintageNote: string;
  wineryDescription: string;
  winemaking: string;
  alcoholPercentage: string;
  agingPotential: string;
  colorNote: string;
  noseNote: string;
  palateNote: string;
  foodPairing: string;
  glassPairing: string;
  servingTemp: string;
  awards: string;
  bottleImageBase64?: string;
  bottleImageMimeType?: string;
}

// ─── 단일 슬라이드 생성 ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTastingNoteSlide(pptx: any, data: SlideData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.WHITE };

  // 1. 좌측 병 영역 배경 패널
  slide.addShape("rect", {
    x: 0,
    y: 0.9,
    w: 2.1,
    h: 8.1,
    fill: { color: C.BG_BOTTLE_AREA, transparency: 40 },
    line: { width: 0 },
  });

  // 2. HEADER - 로고
  try {
    slide.addImage({
      data: "image/jpeg;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.2,
      y: 0.2,
      w: 1.49,
      h: 0.57,
    });
  } catch {
    /* 로고 없으면 무시 */
  }

  // 3. 와이너리 태그라인
  const wineryDesc = data.wineryDescription || "";
  if (wineryDesc) {
    let tagline = wineryDesc.split(".")[0].trim();
    if (!tagline) tagline = wineryDesc.split("。")[0].trim();
    if (tagline) {
      slide.addText(tagline, {
        x: 2.2,
        y: 0.2,
        w: 4.9,
        h: 0.24,
        fontSize: 9,
        color: C.TEXT_MUTED,
        italic: true,
        fontFace: FONT_EN,
      });
    }
  }

  // 4-5. 헤더 구분선 (버건디 + 골드 이중선)
  addLine(slide, 0.2, 0.84, 7.1, C.BURGUNDY, 1.0);
  addLine(slide, 0.2, 0.87, 7.1, C.GOLD_LIGHT, 0.75);

  // ════════════════════════════════════════════
  // 6. 와인명 카드 배경 (둥근 사각형)
  // ════════════════════════════════════════════
  slide.addShape("roundRect", {
    x: 2.05,
    y: 0.97,
    w: 5.2,
    h: 0.82,
    fill: { color: C.BURGUNDY_LIGHT, transparency: 20 },
    rectRadius: 0.05,
    line: { color: C.CARD_BORDER, width: 0.5 },
  });

  // 7. 와인명 텍스트 (한글 + 영문)
  const nameKrClean = data.nameKr.replace(/^[A-Za-z]{2}\s+/, "");
  const nameRuns: PptxGenJS.TextProps[] = [
    {
      text: nameKrClean,
      options: {
        fontSize: 18,
        fontFace: FONT_MAIN,
        color: C.BURGUNDY_DARK,
        bold: true,
      },
    },
  ];
  if (data.nameEn) {
    nameRuns.push({
      text: data.nameEn,
      options: {
        fontSize: 12,
        fontFace: FONT_EN,
        color: "666666",
        italic: true,
        breakLine: true,
        paraSpaceBefore: 4,
      },
    });
  }
  slide.addText(nameRuns, {
    x: 2.2,
    y: 1.0,
    w: 4.9,
    h: 0.78,
    valign: "top",
    wrap: true,
  });

  // 8. 와인명 하단 구분선
  addLine(slide, 2.2, 1.88, 4.9, C.DIVIDER, 0.75);

  // ════════════════════════════════════════════
  // 9-10. 지역
  // ════════════════════════════════════════════
  addLabelBadge(slide, "지역", 2.12, 1.97, 0.55);

  const countryEn = data.countryEn || data.country || "";
  const regionText = data.region
    ? `${countryEn}, ${data.region}`
    : countryEn || "-";
  slide.addText(regionText, {
    x: 2.75,
    y: 1.96,
    w: 4.4,
    h: 0.24,
    fontSize: 9.5,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
  });

  // 구분선
  addLine(slide, 2.2, 2.35, 4.9, C.DIVIDER_LIGHT, 0.5);

  // 11-12. 품종
  addLabelBadge(slide, "품종", 2.12, 2.42, 0.55);
  slide.addText(data.grapeVarieties || "-", {
    x: 2.75,
    y: 2.41,
    w: 4.4,
    h: 0.4,
    fontSize: 9.5,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    wrap: true,
  });

  // ════════════════════════════════════════════
  // 13-14. 빈티지
  // ════════════════════════════════════════════
  addLabelBadge(slide, "빈티지", 2.12, 3.02, 0.65);

  const vintage = data.vintage || "-";
  slide.addText(vintage, {
    x: 2.85,
    y: 2.98,
    w: 0.75,
    h: 0.28,
    fontSize: 13,
    fontFace: FONT_MAIN,
    color: C.BURGUNDY,
    bold: true,
  });

  if (data.vintageNote) {
    slide.addText(data.vintageNote, {
      x: 3.65,
      y: 3.0,
      w: 3.5,
      h: 0.4,
      fontSize: 8,
      fontFace: FONT_MAIN,
      color: C.TEXT_SECONDARY,
      wrap: true,
    });
  }

  // ════════════════════════════════════════════
  // 15-16. 양조
  // ════════════════════════════════════════════
  addLabelBadge(slide, "양조", 2.12, 3.62, 0.55);

  let winemakingText = data.winemaking || "-";
  if (data.alcoholPercentage) {
    winemakingText += `\n알코올: ${data.alcoholPercentage}`;
  }
  slide.addText(winemakingText, {
    x: 2.15,
    y: 3.9,
    w: 5.0,
    h: 0.85,
    fontSize: 9,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    lineSpacing: 12,
    wrap: true,
  });

  // ════════════════════════════════════════════
  // TASTING NOTE (디자인 업그레이드)
  // ════════════════════════════════════════════

  // 배경: 웜 그레이
  slide.addShape("roundRect", {
    x: 2.05,
    y: 4.9,
    w: 5.2,
    h: 3.2,
    fill: { color: C.BG_WARM_GRAY },
    rectRadius: 0.05,
    line: { color: C.CARD_BORDER, width: 0.5 },
  });

  // 좌측 세로 포인트 바 (2pt, #5A1515)
  addVLine(slide, 2.12, 5.22, 8.0, C.WINE_ACCENT, 2.0);

  addLabelBadge(slide, "TASTING NOTE", 2.12, 4.95, 1.32);

  // 테이스팅 노트 내용
  const tastingItems: [string, string][] = [
    ["Color", data.colorNote || ""],
    ["Nose", data.noseNote || ""],
    ["Palate", data.palateNote || ""],
    ["Potential", data.agingPotential || ""],
  ];

  const tastingRuns: PptxGenJS.TextProps[] = [];
  let isFirst = true;
  for (const [label, value] of tastingItems) {
    if (!value) continue;

    const labelOpts: PptxGenJS.TextPropsOptions = {
      fontSize: 8.5,
      fontFace: FONT_EN,
      color: C.BURGUNDY,
      italic: true,
      bold: false,
    };
    if (!isFirst) {
      labelOpts.breakLine = true;
      labelOpts.paraSpaceBefore = 12;
    }
    tastingRuns.push({ text: label, options: labelOpts });

    tastingRuns.push({
      text: `\n${value}`,
      options: {
        fontSize: 9,
        fontFace: FONT_MAIN,
        color: C.TEXT_PRIMARY,
      },
    });

    isFirst = false;
  }

  if (tastingRuns.length === 0) {
    tastingRuns.push({
      text: "-",
      options: { fontSize: 9, fontFace: FONT_MAIN, color: C.TEXT_MUTED },
    });
  }

  slide.addText(tastingRuns, {
    x: 2.25,
    y: 5.22,
    w: 4.85,
    h: 2.82,
    valign: "top",
    wrap: true,
    margin: 0,
  });

  // 푸드 페어링 (미드도트 구분)
  addLabelBadge(slide, "푸드 페어링", 2.12, 8.26, 0.95);
  const foodText = (data.foodPairing || "-").replace(/, /g, " · ").replace(/,/g, " · ");
  slide.addText(foodText, {
    x: 2.15,
    y: 8.5,
    w: 5.0,
    h: 0.36,
    fontSize: 9,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    lineSpacing: 12,
    wrap: true,
  });

  // 수상내역 (배지 스타일)
  addLine(slide, 0.15, 9.04, 7.2, C.GOLD_LIGHT, 0.5);

  const awards = data.awards || "";
  if (awards && awards !== "N/A") {
    addLabelBadge(slide, "AWARDS", 0.2, 9.1, 0.72, 0.2);

    try {
      slide.addImage({
        data: "image/jpeg;base64," + ICON_AWARD_BASE64,
        x: 0.98,
        y: 9.09,
        w: 0.2,
        h: 0.24,
      });
    } catch {
      /* ignore */
    }

    slide.addText(awards, {
      x: 1.22,
      y: 9.09,
      w: 5.9,
      h: 0.36,
      fontSize: 9,
      fontFace: FONT_MAIN,
      color: C.TEXT_PRIMARY,
      lineSpacing: 12,
      wrap: true,
    });
  }

  // ════════════════════════════════════════════
  // 21-23. FOOTER
  // ════════════════════════════════════════════
  addLine(slide, 0.2, 9.52, 7.1, C.BURGUNDY, 2.0);
  addLine(slide, 0.2, 9.55, 7.1, C.GOLD_LIGHT, 0.75);

  // Footer 로고
  try {
    slide.addImage({
      data: "image/jpeg;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.09,
      y: 9.68,
      w: 0.95,
      h: 0.25,
    });
  } catch {
    /* ignore */
  }

  // 회사 정보
  slide.addText("T. 02-786-3136  |  www.cavedevin.co.kr", {
    x: 1.12,
    y: 9.69,
    w: 2.76,
    h: 0.24,
    fontSize: 7,
    fontFace: FONT_MAIN,
    color: C.TEXT_MUTED,
    align: "right",
  });

  // ════════════════════════════════════════════
  // 24. 병 이미지 (있을 때만)
  // ════════════════════════════════════════════
  if (data.bottleImageBase64 && data.bottleImageMimeType) {
    try {
      slide.addImage({
        data: `${data.bottleImageMimeType};base64,${data.bottleImageBase64}`,
        x: 0.25,
        y: 2.0,
        w: 1.6,
        h: 5.5,
        sizing: { type: "contain", w: 1.6, h: 5.5 },
      });
    } catch (e) {
      logger.warn(`[PPT] Failed to add bottle image: ${e}`);
    }
  }
}

// ════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════

/** 단일 와인 테이스팅 노트 PPT 생성 */
export async function generateSingleWinePpt(
  wineId: string
): Promise<Buffer> {
  return generateTastingNotePpt([wineId]);
}

/** 여러 와인의 테이스팅 노트 PPT 생성 */
export async function generateTastingNotePpt(
  wineIds: string[]
): Promise<Buffer> {
  const slides: SlideData[] = [];

  for (const wineId of wineIds) {
    const wine = await getWineByCode(wineId);
    if (!wine) continue;

    const note = await getTastingNote(wineId);

    // 이미지: Vivino 누끼(투명배경) 우선 → 기존 image_url 폴백
    let bottleImageBase64: string | undefined;
    let bottleImageMimeType: string | undefined;

    // 1순위: Vivino 누끼 보틀샷 검색
    const engName = wine.item_name_en;
    if (engName) {
      try {
        const vivinoUrl = await searchVivinoBottleImage(engName);
        if (vivinoUrl) {
          const imgData = await downloadImageAsBase64(vivinoUrl);
          if (imgData) {
            bottleImageBase64 = imgData.base64;
            bottleImageMimeType = imgData.mimeType;
            logger.info(`[PPT] Vivino nukki image for ${wineId}`);
          }
        }
      } catch {
        logger.warn(`[PPT] Vivino search failed for ${wineId}`);
      }
    }

    // 2순위: DB에 저장된 image_url
    if (!bottleImageBase64 && wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          bottleImageBase64 = imgData.base64;
          bottleImageMimeType = imgData.mimeType;
          logger.info(`[PPT] Fallback image for ${wineId}`);
        }
      } catch {
        logger.warn(`[PPT] Image download failed for ${wineId}`);
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
    });
  }

  if (slides.length === 0) {
    throw new Error("생성할 슬라이드가 없습니다.");
  }

  // Presentation 생성
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_PORTRAIT", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "A4_PORTRAIT";

  // 슬라이드 생성
  for (const data of slides) {
    addTastingNoteSlide(pptx, data);
  }

  // Buffer로 출력 후 폰트 임베딩
  const rawBuffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const output = await embedFontsInPptx(rawBuffer);
  logger.info(`PPT generated: ${slides.length} slides (pptxgenjs, font embedded)`);

  return output;
}
