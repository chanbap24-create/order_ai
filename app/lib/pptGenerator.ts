// PPT 생성기 - pptxgenjs 기반 (Vercel 서버리스 호환)
// python-pptx (child_process) → pptxgenjs (pure JS) 마이그레이션

import PptxGenJS from "pptxgenjs";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
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

const FONT_MAIN = "Malgun Gothic";
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

// ─── 라벨 뱃지 (아웃라인 스타일) ───
function addLabelBadge(
  slide: Slide,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number = 0.22,
  style: "outline" | "solid" = "outline"
) {
  if (style === "solid") {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      fill: { color: C.BURGUNDY },
      rectRadius: 0.04,
      line: { width: 0 },
    });
    slide.addText(text, {
      x, y, w, h,
      fontSize: 7.5,
      fontFace: FONT_EN,
      color: C.TEXT_ON_DARK,
      bold: true,
      align: "center",
      valign: "middle",
      charSpacing: 1.5,
    });
  } else {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      fill: { color: C.BURGUNDY_LIGHT, transparency: 50 },
      rectRadius: 0.04,
      line: { color: C.BURGUNDY, width: 0.75 },
    });
    slide.addText(text, {
      x, y, w, h,
      fontSize: 7.5,
      fontFace: FONT_MAIN,
      color: C.BURGUNDY_DARK,
      bold: true,
      align: "center",
      valign: "middle",
    });
  }
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

  // 1. 좌측 병 영역 배경 패널 (경계선 없이 색상만)
  slide.addShape("rect", {
    x: 0,
    y: 0.9,
    w: 2.1,
    h: 8.1,
    fill: { color: C.BG_BOTTLE_AREA, transparency: 30 },
    line: { type: "none" },
  });

  // 2. HEADER - 로고
  try {
    slide.addImage({
      data: "image/png;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.3,
      y: 0.14,
      w: 1.49,
      h: 0.57,
    });
  } catch {
    /* 로고 없으면 무시 */
  }

  // 3. 와이너리 태그라인 (1줄로 제한)
  const wineryDesc = data.wineryDescription || "";
  if (wineryDesc) {
    let tagline = wineryDesc.split(".")[0].trim();
    if (!tagline) tagline = wineryDesc.split("。")[0].trim();
    // 50자 초과 시 말줄임
    if (tagline && tagline.length > 50) {
      tagline = tagline.substring(0, 48) + "…";
    }
    if (tagline) {
      slide.addText(tagline, {
        x: 2.2,
        y: 0.32,
        w: 5.0,
        h: 0.24,
        fontSize: 8,
        color: C.TEXT_MUTED,
        italic: true,
        fontFace: FONT_EN,
        autoFit: true,
      });
    }
  }

  // 4-5. 헤더 구분선 (골드 단선)
  addLine(slide, 0.2, 0.84, 7.1, C.GOLD, 1.5);

  // ════════════════════════════════════════════
  // 6. 와인명 카드 배경 (보더 없는 깔끔한 스타일)
  // ════════════════════════════════════════════
  slide.addShape("roundRect", {
    x: 2.2,
    y: 0.95,
    w: 5.05,
    h: 0.85,
    fill: { color: C.BURGUNDY_LIGHT, transparency: 40 },
    rectRadius: 0.06,
    line: { width: 0 },
  });

  // 좌측 와인명 포인트 바
  slide.addShape("rect", {
    x: 2.2,
    y: 0.99,
    w: 0.06,
    h: 0.77,
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
        fontSize: krFontSize,
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
        fontSize: enFontSize,
        fontFace: FONT_EN,
        color: C.TEXT_SECONDARY,
        italic: true,
      },
    });
  }
  slide.addText(nameRuns, {
    x: 2.4,
    y: 0.98,
    w: 4.7,
    h: 0.8,
    valign: "middle",
    wrap: true,
    autoFit: true,
  });

  // 8. 와인명 하단 골드 구분선
  addLine(slide, 2.35, 1.88, 4.9, C.GOLD, 0.75);

  // ════════════════════════════════════════════
  // 정보 섹션 (등간격 0.45 리듬)
  // ════════════════════════════════════════════
  const SEC_X = 2.35;     // 뱃지 시작
  const VAL_X = 2.95;     // 값 시작
  const SEC_W = 4.75;     // 값 넓이
  const SEC_Y0 = 1.97;    // 첫 섹션 Y
  const SEC_GAP = 0.45;   // 섹션 간격

  const ROW_H = 0.22;      // 통일된 행 높이
  const DIV_OFFSET = 0.32;  // 구분선 오프셋

  // ── 지역 ──
  addLabelBadge(slide, "지역", SEC_X, SEC_Y0, 0.62, ROW_H);
  const countryEn = data.countryEn || data.country || "";
  const regionText = data.region
    ? `${countryEn}, ${data.region}`
    : countryEn || "-";
  slide.addText(regionText, {
    x: VAL_X,
    y: SEC_Y0,
    w: SEC_W,
    h: ROW_H,
    fontSize: 9.5,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    autoFit: true,
    valign: "middle",
  });
  addLine(slide, SEC_X, SEC_Y0 + DIV_OFFSET, 4.9, C.DIVIDER_LIGHT, 0.4);

  // ── 품종 ──
  const Y_GRAPE = SEC_Y0 + SEC_GAP;
  addLabelBadge(slide, "품종", SEC_X, Y_GRAPE, 0.62, ROW_H);
  slide.addText(data.grapeVarieties || "-", {
    x: VAL_X,
    y: Y_GRAPE,
    w: SEC_W,
    h: ROW_H,
    fontSize: 9.5,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    autoFit: true,
    valign: "middle",
  });
  addLine(slide, SEC_X, Y_GRAPE + DIV_OFFSET, 4.9, C.DIVIDER_LIGHT, 0.4);

  // ── 빈티지 ──
  const Y_VINT = SEC_Y0 + SEC_GAP * 2;
  addLabelBadge(slide, "빈티지", SEC_X, Y_VINT, 0.62, ROW_H);
  const vintage = data.vintage || "-";
  slide.addText(vintage, {
    x: 3.05,
    y: Y_VINT,
    w: 0.7,
    h: ROW_H,
    fontSize: 14,
    fontFace: FONT_EN,
    color: C.BURGUNDY,
    bold: true,
    valign: "middle",
  });
  addLine(slide, SEC_X, Y_VINT + DIV_OFFSET, 4.9, C.DIVIDER_LIGHT, 0.4);

  // ── 양조 ──
  const Y_WINE = SEC_Y0 + SEC_GAP * 3;
  addLabelBadge(slide, "양조", SEC_X, Y_WINE, 0.62, ROW_H);
  let winemakingText = data.winemaking || "-";
  if (data.alcoholPercentage) {
    winemakingText += `  |  Alc. ${data.alcoholPercentage}`;
  }
  slide.addText(winemakingText, {
    x: SEC_X,
    y: Y_WINE + 0.26,
    w: 4.85,
    h: 0.9,
    fontSize: 9,
    fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    lineSpacingMultiple: 1.3,
    wrap: true,
    autoFit: true,
  });

  // ════════════════════════════════════════════
  // TASTING NOTE
  // ════════════════════════════════════════════
  const TN_Y = 4.5;   // 양조 바로 아래로 올림
  const TN_H = 4.4;   // 어워드 선(9.05) 직전까지

  // 배경: 보더 없는 웜 그레이
  slide.addShape("roundRect", {
    x: 2.2,
    y: TN_Y,
    w: 5.05,
    h: TN_H,
    fill: { color: C.BG_WARM_GRAY },
    rectRadius: 0.06,
    line: { width: 0 },
  });

  // 좌측 세로 포인트 바 (골드)
  slide.addShape("rect", {
    x: 2.2,
    y: TN_Y,
    w: 0.06,
    h: TN_H,
    fill: { color: C.GOLD },
    line: { width: 0 },
  });

  // TASTING NOTE 타이틀 (solid 스타일)
  addLabelBadge(slide, "TASTING NOTE", 2.35, TN_Y + 0.07, 1.32, 0.22, "solid");

  // 테이스팅 노트 내용 (Color / Nose / Palate 분리 배치)
  const tastingItems: [string, string][] = [
    ["Color", data.colorNote || ""],
    ["Nose", data.noseNote || ""],
    ["Palate", data.palateNote || ""],
  ];

  const tastingRuns: PptxGenJS.TextProps[] = [];
  let isFirst = true;
  for (const [label, value] of tastingItems) {
    if (!value) continue;

    if (!isFirst) {
      // 섹션 간 빈 줄로 여백 확보
      tastingRuns.push({
        text: "\n",
        options: { fontSize: 5, breakLine: true },
      });
    }

    // 라벨: 대문자 + 골드 대시 접두어
    tastingRuns.push({
      text: `— ${label.toUpperCase()}`,
      options: {
        fontSize: 8,
        fontFace: FONT_EN,
        color: C.GOLD,
        bold: true,
        breakLine: !isFirst,
        charSpacing: 2,
      },
    });

    // 내용
    tastingRuns.push({
      text: `\n${value}`,
      options: {
        fontSize: 9,
        fontFace: FONT_MAIN,
        color: C.TEXT_PRIMARY,
        lineSpacingMultiple: 1.3,
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
    x: 2.45,
    y: TN_Y + 0.4,
    w: 4.65,
    h: TN_H - 0.5,
    valign: "top",
    wrap: true,
    margin: [0, 5, 0, 5],
    autoFit: true,
  });

  // 수상내역 (상단선 y=9.05, 하단 푸터선 y=9.5 → 중앙 배치)
  addLine(slide, 0.3, 9.05, 6.9, C.GOLD_LIGHT, 0.5);

  const awards = data.awards || "";
  if (awards && awards !== "N/A") {
    // 상단선(9.05)~푸터선(9.5) 사이 높이=0.45, 중앙 배치
    const AWARD_Y = 9.12;
    const AWARD_H = 0.32;

    try {
      slide.addImage({
        data: "image/jpeg;base64," + ICON_AWARD_BASE64,
        x: 0.3,
        y: AWARD_Y + 0.04,
        w: 0.2,
        h: 0.24,
      });
    } catch {
      /* ignore */
    }

    slide.addText("AWARDS", {
      x: 0.54,
      y: AWARD_Y,
      w: 0.9,
      h: AWARD_H,
      fontSize: 7.5,
      fontFace: FONT_EN,
      color: C.BURGUNDY,
      bold: true,
      charSpacing: 1.5,
      valign: "middle",
    });

    slide.addText(awards, {
      x: 1.45,
      y: AWARD_Y,
      w: 5.7,
      h: AWARD_H,
      fontSize: 8.5,
      fontFace: FONT_MAIN,
      color: C.TEXT_PRIMARY,
      lineSpacing: 12,
      wrap: true,
      autoFit: true,
      valign: "middle",
    });
  }

  // ════════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════════
  addLine(slide, 0.3, 9.5, 6.9, C.GOLD, 1.0);

  // Footer 로고 (헤더 로고와 동일 x선상)
  try {
    slide.addImage({
      data: "image/png;base64," + LOGO_CAVEDEVIN_BASE64,
      x: 0.3,
      y: 9.58,
      w: 1.1,
      h: 0.42,
      sizing: { type: "contain", w: 1.1, h: 0.42 },
    });
  } catch {
    /* ignore */
  }

  // 회사 정보 (우측 정렬)
  slide.addText("T. 02-786-3136  |  www.cavedevin.com", {
    x: 4.2,
    y: 9.62,
    w: 3.0,
    h: 0.3,
    fontSize: 7.5,
    fontFace: FONT_EN,
    color: C.TEXT_MUTED,
    align: "right",
    valign: "middle",
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
        h: 6.6,
        sizing: { type: "contain", w: 1.6, h: 6.6 },
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

    // 이미지: DB image_url 우선 → Vivino 누끼 폴백
    let bottleImageBase64: string | undefined;
    let bottleImageMimeType: string | undefined;

    // 1순위: DB에 저장된 image_url (관리자 수정 가능)
    if (wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          bottleImageBase64 = imgData.base64;
          bottleImageMimeType = imgData.mimeType;
          logger.info(`[PPT] DB image for ${wineId}`);
        }
      } catch {
        logger.warn(`[PPT] Image download failed for ${wineId}`);
      }
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

  // Buffer로 출력
  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  logger.info(`PPT generated: ${slides.length} slides (pptxgenjs)`);

  return output;
}
