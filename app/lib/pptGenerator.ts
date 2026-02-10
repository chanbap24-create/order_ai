// PPT 생성기 - pptxgenjs 사용
// 테이스팅 노트 슬라이드 생성

import PptxGenJS from "pptxgenjs";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { logger } from "@/app/lib/logger";

const PRIMARY_COLOR = '8B1538';
const TEXT_COLOR = '1A1A1A';
const LIGHT_TEXT = '666666';
const BG_COLOR = 'FFFFFF';
const ACCENT_BG = 'F8F4F0';

interface SlideData {
  itemCode: string;
  nameKr: string;
  nameEn: string;
  country: string;
  region: string;
  grapeVarieties: string;
  vintage: string;
  wineType: string;
  winemaking: string;
  colorNote: string;
  noseNote: string;
  palateNote: string;
  foodPairing: string;
  glassPairing: string;
  servingTemp: string;
  awards: string;
}

function addTastingNoteSlide(pptx: PptxGenJS, data: SlideData) {
  const slide = pptx.addSlide();
  slide.background = { color: BG_COLOR };

  // 상단 와인명 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.9,
    fill: { color: PRIMARY_COLOR },
  });

  // 와인명 (한글)
  slide.addText(data.nameKr, {
    x: 0.5, y: 0.1, w: 8.5, h: 0.4,
    fontSize: 20, fontFace: 'Malgun Gothic',
    color: 'FFFFFF', bold: true,
  });

  // 와인명 (영문)
  slide.addText(data.nameEn || '', {
    x: 0.5, y: 0.5, w: 8.5, h: 0.3,
    fontSize: 12, fontFace: 'Calibri',
    color: 'DDBBBB', italic: true,
  });

  // 좌측 정보 영역
  const infoStartY = 1.2;

  // 국가/지역
  slide.addText([
    { text: '국가  ', options: { fontSize: 10, color: LIGHT_TEXT, fontFace: 'Malgun Gothic' } },
    { text: `${data.country}${data.region ? ' - ' + data.region : ''}`, options: { fontSize: 11, color: TEXT_COLOR, bold: true, fontFace: 'Malgun Gothic' } },
  ], { x: 0.5, y: infoStartY, w: 4, h: 0.3 });

  // 품종
  slide.addText([
    { text: '품종  ', options: { fontSize: 10, color: LIGHT_TEXT, fontFace: 'Malgun Gothic' } },
    { text: data.grapeVarieties || '-', options: { fontSize: 11, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: 0.5, y: infoStartY + 0.35, w: 4, h: 0.3 });

  // 빈티지 & 타입
  slide.addText([
    { text: '빈티지  ', options: { fontSize: 10, color: LIGHT_TEXT, fontFace: 'Malgun Gothic' } },
    { text: data.vintage || '-', options: { fontSize: 11, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
    { text: '    타입  ', options: { fontSize: 10, color: LIGHT_TEXT, fontFace: 'Malgun Gothic' } },
    { text: data.wineType || '-', options: { fontSize: 11, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: 0.5, y: infoStartY + 0.7, w: 4, h: 0.3 });

  // 양조
  if (data.winemaking) {
    slide.addText([
      { text: '양조\n', options: { fontSize: 10, color: PRIMARY_COLOR, bold: true, fontFace: 'Malgun Gothic' } },
      { text: data.winemaking, options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
    ], { x: 0.5, y: infoStartY + 1.15, w: 4.2, h: 0.8, valign: 'top' });
  }

  // 테이스팅 노트 영역 (우측)
  const noteX = 5.0;
  slide.addShape(pptx.ShapeType.rect, {
    x: noteX - 0.1, y: infoStartY - 0.1, w: 4.7, h: 3.6,
    fill: { color: ACCENT_BG }, rectRadius: 0.1,
  });

  slide.addText('TASTING NOTES', {
    x: noteX, y: infoStartY, w: 4.5, h: 0.3,
    fontSize: 12, fontFace: 'Calibri',
    color: PRIMARY_COLOR, bold: true,
  });

  // Color
  slide.addText([
    { text: 'Color  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
    { text: data.colorNote || '-', options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: noteX, y: infoStartY + 0.4, w: 4.3, h: 0.5, valign: 'top' });

  // Nose
  slide.addText([
    { text: 'Nose  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
    { text: data.noseNote || '-', options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: noteX, y: infoStartY + 1.0, w: 4.3, h: 0.6, valign: 'top' });

  // Palate
  slide.addText([
    { text: 'Palate  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
    { text: data.palateNote || '-', options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: noteX, y: infoStartY + 1.7, w: 4.3, h: 0.7, valign: 'top' });

  // Food Pairing
  slide.addText([
    { text: 'Food Pairing  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
    { text: data.foodPairing || '-', options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: noteX, y: infoStartY + 2.5, w: 4.3, h: 0.5, valign: 'top' });

  // Glass & Temp
  slide.addText([
    { text: 'Glass  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
    { text: data.glassPairing || '-', options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
    { text: '    Temp  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
    { text: data.servingTemp || '-', options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
  ], { x: noteX, y: infoStartY + 3.1, w: 4.3, h: 0.3 });

  // 수상내역
  if (data.awards && data.awards !== 'N/A') {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 4.5, w: 9.2, h: 0.4,
      fill: { color: 'FFF8E1' }, rectRadius: 0.05,
    });
    slide.addText([
      { text: 'Awards  ', options: { fontSize: 9, color: PRIMARY_COLOR, bold: true, fontFace: 'Calibri' } },
      { text: data.awards, options: { fontSize: 9, color: TEXT_COLOR, fontFace: 'Malgun Gothic' } },
    ], { x: 0.5, y: 4.5, w: 9, h: 0.4, valign: 'middle' });
  }

  // 하단 회사정보
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.05, w: '100%', h: 0.45,
    fill: { color: PRIMARY_COLOR },
  });
  slide.addText('㈜까브드뱅  T.02-786-3136  |  www.cavedevin.co.kr', {
    x: 0, y: 5.1, w: '100%', h: 0.35,
    fontSize: 10, fontFace: 'Malgun Gothic',
    color: 'FFFFFF', align: 'center',
  });
}

/** 단일 와인 테이스팅 노트 PPT 생성 → Buffer 반환 */
export async function generateSingleWinePpt(wineId: string): Promise<Buffer> {
  return generateTastingNotePpt([wineId]);
}

/** 여러 와인의 테이스팅 노트 PPT 생성 → Buffer 반환 */
export async function generateTastingNotePpt(wineIds: string[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pptx.author = '까브드뱅 와인 관리 시스템';

  let slideCount = 0;

  for (const wineId of wineIds) {
    const wine = getWineByCode(wineId);
    if (!wine) continue;

    const note = getTastingNote(wineId);

    addTastingNoteSlide(pptx, {
      itemCode: wine.item_code,
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || '',
      country: wine.country_en || wine.country || '',
      region: wine.region || '',
      grapeVarieties: wine.grape_varieties || '',
      vintage: wine.vintage || '',
      wineType: wine.wine_type || '',
      winemaking: note?.winemaking || '',
      colorNote: note?.color_note || '',
      noseNote: note?.nose_note || '',
      palateNote: note?.palate_note || '',
      foodPairing: note?.food_pairing || '',
      glassPairing: note?.glass_pairing || '',
      servingTemp: note?.serving_temp || '',
      awards: note?.awards || '',
    });
    slideCount++;
  }

  if (slideCount === 0) {
    throw new Error("생성할 슬라이드가 없습니다.");
  }

  logger.info(`PPT generated: ${slideCount} slides`);

  // pptxgenjs write returns base64 or Uint8Array
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
