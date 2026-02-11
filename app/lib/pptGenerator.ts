// PPT 생성기 - pptxgenjs 사용
// 샘플 3020050.pptx 레이아웃 정밀 재현 (세로 A4, 좌측 병사진 + 우측 정보)
// 모든 좌표는 sample/3020050.pptx를 python-pptx로 파싱한 값 그대로 사용

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

// 폰트 (템플릿 3020050.pptx 기준)
const FONT_MAIN = '맑은 고딕';    // 메인 본문 폰트
const FONT_EN = 'Noto Sans KR';   // 영문 와인명

// 슬라이드 크기 (인치) - 세로 A4
const SLIDE_W = 7.5;
const SLIDE_H = 10.0;

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
  bottleImageMime?: string;
}

function addTastingNoteSlide(pptx: PptxGenJS, data: SlideData) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  // ════════════════════════════════════════════
  // HEADER 영역
  // ════════════════════════════════════════════

  // Logo (Shape 24: left=0.20in, top=0.20in, w=1.49in, h=0.57in)
  try {
    slide.addImage({ data: LOGO_DATA, x: 0.20, y: 0.20, w: 1.49, h: 0.57 });
  } catch { /* logo failed */ }

  // 와이너리 소개 태그라인 (Shape 27: left=1.66in, top=0.13in, w=4.45in, h=0.27in)
  if (data.wineryDescription) {
    const tagline = data.wineryDescription.split(/[.。]/)[0].trim();
    if (tagline) {
      slide.addText(tagline, {
        x: 1.66, y: 0.13, w: 4.45, h: 0.27,
        fontSize: 10, fontFace: FONT_MAIN, color: TEXT_COLOR, italic: true,
      });
    }
  }

  // 헤더 구분선 (Shape 1: left=0.21in, top=0.84in, w=7.09in, 0.5pt solid)
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: 0.21, y: 0.84, w: 7.09, h: 0,
    line: { color: TEXT_COLOR, width: 0.5 },
  });

  // ════════════════════════════════════════════
  // 와인명 (Shape 2: left=2.12in, top=1.08in, w=4.21in, h=0.63in)
  // P0: 한글명 14.5pt / P1: 영문명 11pt bold italic
  // ════════════════════════════════════════════
  const nameTextParts: PptxGenJS.TextProps[] = [
    {
      text: data.nameKr,
      options: { fontSize: 14.5, fontFace: FONT_MAIN, color: TEXT_COLOR, breakType: 'none' as const },
    },
  ];
  if (data.nameEn) {
    nameTextParts.push({
      text: data.nameEn,
      options: { fontSize: 11, fontFace: FONT_EN, color: TEXT_COLOR, bold: true, italic: true, paraSpaceBefore: 2 },
    });
  }
  slide.addText(nameTextParts, {
    x: 2.12, y: 1.08, w: 4.21, h: 0.63,
    valign: 'top',
  });

  // ════════════════════════════════════════════
  // 와인 병 이미지 (Shape 0: left=0.00in, top=1.62in, w=2.13in, h=7.73in)
  // ════════════════════════════════════════════
  if (data.bottleImageBase64) {
    try {
      slide.addImage({
        data: `image/${data.bottleImageMime || 'jpeg'};base64,${data.bottleImageBase64}`,
        x: 0, y: 1.62, w: 2.13, h: 7.73,
        sizing: { type: 'contain', w: 2.13, h: 7.73 },
      });
    } catch { /* image failed */ }
  }

  // 와인명 하단 점선 (Shape 7: left=2.19in, top=1.82in, w=3.28in, 1.5pt round dot)
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: 2.19, y: 1.82, w: 3.28, h: 0,
    line: { color: TEXT_COLOR, width: 1.5, dashType: 'sysDot' },
  });

  // ════════════════════════════════════════════
  // 와인 상세 정보
  // ════════════════════════════════════════════

  // ─── 지역 ───
  // Label (Shape 3: left=2.10in, top=1.93in, w=0.51in, h=0.29in, 11pt bold)
  slide.addText('지역', {
    x: 2.10, y: 1.93, w: 0.51, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Value (Shape 4: left=2.10in, top=2.13in, w=4.24in, h=0.27in, 10pt)
  const regionText = data.region
    ? `${data.countryEn || data.country}, ${data.region}`
    : (data.countryEn || data.country || '-');
  slide.addText(regionText, {
    x: 2.10, y: 2.13, w: 4.24, h: 0.27,
    fontSize: 10, fontFace: FONT_MAIN, color: TEXT_COLOR, wrap: true,
  });

  // ─── 품종 ───
  // Label (Shape 5: left=2.12in, top=2.42in, w=0.51in, h=0.29in, 11pt bold)
  slide.addText('품종', {
    x: 2.12, y: 2.42, w: 0.51, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Value (Shape 6: left=2.12in, top=2.71in, w=4.33in, h=0.27in, 10pt)
  slide.addText(data.grapeVarieties || '-', {
    x: 2.12, y: 2.71, w: 4.33, h: 0.27,
    fontSize: 10, fontFace: FONT_MAIN, color: TEXT_COLOR, wrap: true,
  });

  // ─── 빈티지 ───
  // Label (Shape 22: left=2.12in, top=3.02in, w=0.66in, h=0.29in, 11pt bold)
  slide.addText('빈티지', {
    x: 2.12, y: 3.02, w: 0.66, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Value (Shape 23: left=2.10in, top=3.29in, w=4.86in, h=0.27in, 10pt)
  slide.addText(data.vintageNote || data.vintage || '-', {
    x: 2.10, y: 3.29, w: 4.86, h: 0.27,
    fontSize: 10, fontFace: FONT_MAIN, color: TEXT_COLOR, wrap: true,
  });

  // ─── 양조 ───
  // Label (Shape 14: left=2.14in, top=3.82in, w=0.51in, h=0.29in, 11pt bold)
  slide.addText('양조', {
    x: 2.14, y: 3.82, w: 0.51, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Content (Shape 19: left=2.13in, top=4.11in, w=5.16in, h=1.21in, 9pt)
  const wineMakingText = data.winemaking || '-';
  const alcoholLine = data.alcoholPercentage ? `\n알코올: ${data.alcoholPercentage}` : '';
  slide.addText(wineMakingText + alcoholLine, {
    x: 2.13, y: 4.11, w: 5.16, h: 1.21,
    fontSize: 9, fontFace: FONT_MAIN, color: TEXT_COLOR, valign: 'top', wrap: true,
  });

  // ─── 테이스팅 노트 ───
  // Label (Shape 15: left=2.10in, top=5.63in, w=1.18in, h=0.29in, 11pt bold)
  slide.addText('테이스팅 노트', {
    x: 2.10, y: 5.63, w: 1.18, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Content (Shape 20: left=2.14in, top=5.86in, w=5.16in, h=1.43in, 9pt)
  const tastingLines: string[] = [];
  if (data.colorNote) tastingLines.push(`컬러: ${data.colorNote}`);
  if (data.noseNote) tastingLines.push(`노즈: ${data.noseNote}`);
  if (data.palateNote) tastingLines.push(`팔렛: ${data.palateNote}`);
  if (data.agingPotential) tastingLines.push(`잠재력: ${data.agingPotential}`);
  if (data.servingTemp) tastingLines.push(`서빙 온도: ${data.servingTemp}`);
  slide.addText(tastingLines.join('\n') || '-', {
    x: 2.14, y: 5.86, w: 5.16, h: 1.43,
    fontSize: 9, fontFace: FONT_MAIN, color: TEXT_COLOR, valign: 'top', wrap: true,
  });

  // ─── 푸드 페어링 ───
  // Label (Shape 17: left=2.13in, top=7.36in, w=1.03in, h=0.29in, 11pt bold)
  slide.addText('푸드 페어링', {
    x: 2.13, y: 7.36, w: 1.03, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Value (Shape 16: left=2.13in, top=7.70in, w=5.25in, h=0.25in, 9pt)
  slide.addText(data.foodPairing || '-', {
    x: 2.13, y: 7.70, w: 5.25, h: 0.25,
    fontSize: 9, fontFace: FONT_MAIN, color: TEXT_COLOR, wrap: true,
  });

  // ─── 글라스 페어링 ───
  // Label (Shape 18: left=2.10in, top=8.15in, w=1.18in, h=0.29in, 11pt bold)
  slide.addText('글라스 페어링', {
    x: 2.10, y: 8.15, w: 1.18, h: 0.29,
    fontSize: 11, fontFace: FONT_MAIN, bold: true, color: TEXT_COLOR,
  });
  // Value (Shape 21: left=2.10in, top=8.49in, w=5.58in, h=0.56in, 9pt)
  slide.addText(data.glassPairing || '-', {
    x: 2.10, y: 8.49, w: 5.58, h: 0.56,
    fontSize: 9, fontFace: FONT_MAIN, color: TEXT_COLOR, valign: 'top', wrap: true,
  });

  // ════════════════════════════════════════════
  // 수상내역 영역
  // ════════════════════════════════════════════

  // 점선 (Shape 10: left=0.26in, top=9.06in, w=7.09in, 1.5pt round dot)
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: 0.26, y: 9.06, w: 7.09, h: 0,
    line: { color: TEXT_COLOR, width: 1.5, dashType: 'sysDot' },
  });

  // 수상 아이콘 (Shape 13: left=0.30in, top=9.13in, w=0.20in, h=0.25in)
  try {
    slide.addImage({ data: AWARD_ICON_DATA, x: 0.30, y: 9.13, w: 0.20, h: 0.25 });
  } catch { /* icon failed */ }

  // 수상내역 텍스트 (Shape 12: left=0.51in, top=9.13in)
  const awardsText = data.awards && data.awards !== 'N/A'
    ? `수상내역  ${data.awards}`
    : '수상내역';
  slide.addText(awardsText, {
    x: 0.51, y: 9.13, w: 6.5, h: 0.27,
    fontSize: 10, fontFace: FONT_MAIN, color: TEXT_COLOR,
  });

  // ════════════════════════════════════════════
  // FOOTER 영역
  // ════════════════════════════════════════════

  // 실선 (Shape 11: left=0.21in, top=9.52in, w=7.09in, 3pt solid)
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: 0.21, y: 9.52, w: 7.09, h: 0,
    line: { color: TEXT_COLOR, width: 3.0 },
  });

  // 로고 (Shape 9: left=0.09in, top=9.70in, w=0.95in, h=0.25in)
  try {
    slide.addImage({ data: LOGO_DATA, x: 0.09, y: 9.70, w: 0.95, h: 0.25 });
  } catch { /* logo failed */ }

  // 회사 정보 (Shape 8: left=1.12in, top=9.71in, w=2.76in, h=0.24in, 7.5pt right)
  slide.addText('㈜까브드뱅   T. 02-786-3136 |  www.cavedevin.co.kr', {
    x: 1.12, y: 9.71, w: 2.76, h: 0.24,
    fontSize: 7.5, fontFace: FONT_MAIN, color: TEXT_COLOR, align: 'right',
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
      vintageNote: note?.vintage_note || '',
      wineryDescription: note?.winery_description || '',
      winemaking: note?.winemaking || '',
      alcoholPercentage: wine.alcohol || '',
      agingPotential: note?.aging_potential || '',
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
