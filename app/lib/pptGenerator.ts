// PPT 생성기 - pptxgenjs 사용
// 샘플 3020050.pptx 레이아웃 재현 (세로 A4, 좌측 병사진 + 우측 정보)

import PptxGenJS from "pptxgenjs";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64 } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

// base64 이미지 데이터 URI
const LOGO_DATA = `image/jpeg;base64,${LOGO_CAVEDEVIN_BASE64}`;
const AWARD_ICON_DATA = `image/jpeg;base64,${ICON_AWARD_BASE64}`;

// 색상
const TEXT_COLOR = '000000';
const GRAY_75 = '404040';

// 폰트
const FONT_KR = 'Malgun Gothic';

// 슬라이드 크기 (인치) - 세로 A4
const SLIDE_W = 7.5;
const SLIDE_H = 10.0;

// 레이아웃 좌표
const LEFT_COL_W = 2.1;
const RIGHT_X = 2.12;
const RIGHT_W = 5.16;
const MARGIN = 0.2;

interface SlideData {
  nameKr: string;
  nameEn: string;
  country: string;
  countryEn: string;
  region: string;
  grapeVarieties: string;
  vintage: string;
  winemaking: string;
  colorNote: string;
  noseNote: string;
  palateNote: string;
  foodPairing: string;
  glassPairing: string;
  servingTemp: string;
  awards: string;
  bottleImageBase64?: string;
  bottleImageMime?: string;
}

function addTastingNoteSlide(pptx: PptxGenJS, data: SlideData) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  // ─── HEADER ───
  try {
    slide.addImage({ data: LOGO_DATA, x: MARGIN, y: MARGIN, w: 1.49, h: 0.57 });
  } catch { /* logo failed */ }

  // 헤더 구분선
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: MARGIN, y: 0.84, w: 7.09, h: 0,
    line: { color: TEXT_COLOR, width: 0.5 },
  });

  // ─── 와인명 ───
  slide.addText(data.nameKr, {
    x: RIGHT_X, y: 1.08, w: 4.21, h: 0.35,
    fontSize: 14.5, fontFace: FONT_KR, color: TEXT_COLOR,
  });

  if (data.nameEn) {
    slide.addText(data.nameEn, {
      x: RIGHT_X, y: 1.43, w: 4.21, h: 0.3,
      fontSize: 11, fontFace: FONT_KR, color: TEXT_COLOR, bold: true, italic: true,
    });
  }

  // 와인명 하단 점선
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: RIGHT_X + 0.07, y: 1.82, w: 3.28, h: 0,
    line: { color: TEXT_COLOR, width: 1.5, dashType: 'sysDot' },
  });

  // ─── 와인 병 이미지 (좌측) ───
  if (data.bottleImageBase64) {
    try {
      slide.addImage({
        data: `image/${data.bottleImageMime || 'jpeg'};base64,${data.bottleImageBase64}`,
        x: 0, y: 1.62, w: LEFT_COL_W, h: 7.73,
        sizing: { type: 'contain', w: LEFT_COL_W, h: 7.73 },
      });
    } catch { /* image failed */ }
  }

  // ─── 와인 상세 정보 ───
  let y = 1.93;

  // 지역
  slide.addText('지역', { x: RIGHT_X, y, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });
  y += 0.22;
  const regionText = data.region ? `${data.countryEn || data.country}, ${data.region}` : (data.countryEn || data.country || '-');
  slide.addText(regionText, { x: RIGHT_X, y, w: RIGHT_W, h: 0.22, fontSize: 10, fontFace: FONT_KR, color: TEXT_COLOR });
  y += 0.3;

  // 품종
  slide.addText('품종', { x: RIGHT_X, y, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });
  y += 0.22;
  slide.addText(data.grapeVarieties || '-', { x: RIGHT_X, y, w: RIGHT_W, h: 0.22, fontSize: 10, fontFace: FONT_KR, color: TEXT_COLOR });
  y += 0.3;

  // 빈티지
  slide.addText('빈티지', { x: RIGHT_X, y, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });
  y += 0.22;
  slide.addText(data.vintage || '-', { x: RIGHT_X, y, w: RIGHT_W, h: 0.3, fontSize: 10, fontFace: FONT_KR, color: TEXT_COLOR });
  y += 0.35;

  // ─── 양조 ───
  slide.addText('양조', { x: RIGHT_X, y, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });
  y += 0.25;
  if (data.winemaking) {
    slide.addText(data.winemaking, { x: RIGHT_X, y, w: RIGHT_W, h: 1.1, fontSize: 9, fontFace: FONT_KR, color: TEXT_COLOR, valign: 'top', wrap: true });
    y += 1.15;
  } else {
    y += 0.3;
  }

  // ─── 테이스팅 노트 ───
  const noteY = Math.max(y, 5.63);
  slide.addText('테이스팅 노트', { x: RIGHT_X, y: noteY, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });

  const tastingLines: string[] = [];
  if (data.colorNote) tastingLines.push(`컬러: ${data.colorNote}`);
  if (data.noseNote) tastingLines.push(`노즈: ${data.noseNote}`);
  if (data.palateNote) tastingLines.push(`팔렛: ${data.palateNote}`);
  if (data.servingTemp) tastingLines.push(`서빙 온도: ${data.servingTemp}`);

  slide.addText(tastingLines.join('\n'), {
    x: RIGHT_X, y: noteY + 0.25, w: RIGHT_W, h: 1.4,
    fontSize: 9, fontFace: FONT_KR, color: TEXT_COLOR, valign: 'top', wrap: true, lineSpacingMultiple: 1.3,
  });

  // ─── 푸드 페어링 ───
  const foodY = noteY + 1.75;
  slide.addText('푸드 페어링', { x: RIGHT_X, y: foodY, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });
  slide.addText(data.foodPairing || '-', { x: RIGHT_X, y: foodY + 0.25, w: RIGHT_W, h: 0.4, fontSize: 9, fontFace: FONT_KR, color: TEXT_COLOR, valign: 'top', wrap: true });

  // ─── 글라스 페어링 ───
  const glassY = foodY + 0.75;
  slide.addText('글라스 페어링', { x: RIGHT_X, y: glassY, w: RIGHT_W, h: 0.22, fontSize: 11, fontFace: FONT_KR, bold: true, color: TEXT_COLOR });
  slide.addText(data.glassPairing || '-', { x: RIGHT_X, y: glassY + 0.25, w: RIGHT_W, h: 0.55, fontSize: 9, fontFace: FONT_KR, color: TEXT_COLOR, valign: 'top', wrap: true });

  // ─── 수상내역 ───
  const awardY = 9.06;
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: 0.26, y: awardY, w: 7.09, h: 0,
    line: { color: GRAY_75, width: 1.5, dashType: 'sysDot' },
  });

  try {
    slide.addImage({ data: AWARD_ICON_DATA, x: 0.3, y: awardY + 0.07, w: 0.2, h: 0.25 });
  } catch { /* icon failed */ }

  slide.addText('수상내역', { x: 0.51, y: awardY + 0.07, w: 0.77, h: 0.25, fontSize: 10, fontFace: FONT_KR, color: TEXT_COLOR });

  if (data.awards && data.awards !== 'N/A') {
    slide.addText(data.awards, { x: 1.35, y: awardY + 0.07, w: 5.8, h: 0.25, fontSize: 9, fontFace: FONT_KR, color: TEXT_COLOR });
  }

  // ─── FOOTER ───
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: MARGIN, y: 9.52, w: 7.09, h: 0,
    line: { color: GRAY_75, width: 3.0 },
  });

  try {
    slide.addImage({ data: LOGO_DATA, x: 0.09, y: 9.7, w: 0.95, h: 0.25 });
  } catch { /* logo failed */ }

  slide.addText('㈜까브드뱅   T. 02-786-3136 |  www.cavedevin.co.kr', {
    x: 1.12, y: 9.71, w: 2.76, h: 0.24,
    fontSize: 7.5, fontFace: FONT_KR, color: TEXT_COLOR, align: 'right',
  });
}

/** 단일 와인 테이스팅 노트 PPT 생성 */
export async function generateSingleWinePpt(wineId: string): Promise<Buffer> {
  return generateTastingNotePpt([wineId]);
}

/** 여러 와인의 테이스팅 노트 PPT 생성 */
export async function generateTastingNotePpt(wineIds: string[]): Promise<Buffer> {
  const pptx = new PptxGenJS();

  pptx.defineLayout({ name: 'PORTRAIT', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'PORTRAIT';
  pptx.author = '까브드뱅 와인 관리 시스템';
  pptx.title = 'Tasting Notes';

  let slideCount = 0;

  for (const wineId of wineIds) {
    const wine = getWineByCode(wineId);
    if (!wine) continue;

    const note = getTastingNote(wineId);

    // 이미지: URL에서 다운로드
    let bottleImageBase64: string | undefined;
    let bottleImageMime: string | undefined;

    if (wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          bottleImageBase64 = imgData.base64;
          bottleImageMime = imgData.mimeType;
        }
      } catch {
        logger.warn(`[PPT] Image download failed for ${wineId}`);
      }
    }

    addTastingNoteSlide(pptx, {
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || '',
      country: wine.country || '',
      countryEn: wine.country_en || '',
      region: wine.region || '',
      grapeVarieties: wine.grape_varieties || '',
      vintage: wine.vintage || '',
      winemaking: note?.winemaking || '',
      colorNote: note?.color_note || '',
      noseNote: note?.nose_note || '',
      palateNote: note?.palate_note || '',
      foodPairing: note?.food_pairing || '',
      glassPairing: note?.glass_pairing || '',
      servingTemp: note?.serving_temp || '',
      awards: note?.awards || '',
      bottleImageBase64,
      bottleImageMime,
    });
    slideCount++;
  }

  if (slideCount === 0) {
    throw new Error("생성할 슬라이드가 없습니다.");
  }

  logger.info(`PPT generated: ${slideCount} slides`);

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
