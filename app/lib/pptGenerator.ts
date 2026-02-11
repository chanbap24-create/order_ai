// PPT 생성기 - pptxgenjs 사용
// 샘플 3020050.pptx 레이아웃 기반 + nanobana-ppt 스킬 디자인 기법 적용
// 글래스모피즘 카드, 와인 테마 컬러, Bento 그리드, 향상된 타이포그래피

import PptxGenJS from "pptxgenjs";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

// base64 이미지 데이터 URI
const LOGO_DATA = `image/jpeg;base64,${LOGO_CAVEDEVIN_BASE64}`;
const AWARD_ICON_DATA = `image/jpeg;base64,${ICON_AWARD_BASE64}`;

// ═══════════════════════════════════════════════════
// 와인 테마 컬러 팔레트 (nanobana-ppt 디자인 기법)
// ═══════════════════════════════════════════════════
const COLORS = {
  // 배경
  BG_CREAM: 'FAF7F2',         // 따뜻한 크림색 배경
  BG_BOTTLE_AREA: 'F5F0EA',   // 병 영역 배경 (미세하게 진한 크림)

  // 와인 버건디 계열
  BURGUNDY: '722F37',          // 딥 버건디 (메인 악센트)
  BURGUNDY_DARK: '5A252C',     // 다크 버건디 (강조)
  BURGUNDY_LIGHT: 'F2E8EA',    // 라이트 버건디 (카드 배경)

  // 골드 악센트
  GOLD: 'B8976A',              // 워밍 골드 (장식)
  GOLD_LIGHT: 'D4C4A8',        // 라이트 골드

  // 텍스트
  TEXT_PRIMARY: '2C2C2C',      // 딥 차콜 (순흑 대신)
  TEXT_SECONDARY: '5A5A5A',    // 세컨더리 텍스트
  TEXT_MUTED: '8A8A8A',        // 뮤트 텍스트
  TEXT_ON_DARK: 'FFFFFF',      // 다크 배경 위 텍스트

  // 카드 & 라인
  CARD_BORDER: 'E0D5C8',      // 따뜻한 카드 테두리
  CARD_SHADOW: '000000',       // 그림자 (투명도 적용)
  DIVIDER: 'D4C4A8',          // 구분선 (골드톤)
  DIVIDER_LIGHT: 'E8DDD0',    // 라이트 구분선
};

// 폰트
const FONT_MAIN = '맑은 고딕';
const FONT_EN = 'Noto Sans KR';

// 슬라이드 크기 (인치) - 세로 A4
const SLIDE_W = 7.5;
const SLIDE_H = 10.0;

// 카드 스타일 (글래스모피즘 효과)
const CARD_RADIUS = 0.08;
const CARD_SHADOW: PptxGenJS.ShadowProps = {
  type: 'outer',
  blur: 4,
  offset: 1.5,
  angle: 135,
  color: COLORS.CARD_SHADOW,
  opacity: 0.08,
};
const LABEL_BADGE_OPTS = {
  fill: { color: COLORS.BURGUNDY },
  rectRadius: 0.04,
  color: COLORS.TEXT_ON_DARK,
  fontSize: 8.5,
  fontFace: FONT_MAIN,
  bold: true as const,
};

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

// ─── 헬퍼: 빈티지 2자리→4자리 변환 ───
function formatVintage4(v: string): string {
  if (!v || v === '-') return '-';
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) {
    return num >= 50 ? `19${String(num).padStart(2, '0')}` : `20${String(num).padStart(2, '0')}`;
  }
  return v;
}

// ─── 헬퍼: 한글명 앞 영어약어 2자 제거 ───
function stripKrPrefix(name: string): string {
  return name.replace(/^[A-Za-z]{2}\s+/, '');
}

// ─── 헬퍼: Bento 스타일 카드 배경 ───
function addBentoCard(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  opts?: { fillColor?: string; borderColor?: string; transparency?: number }
) {
  slide.addShape('roundRect' as PptxGenJS.SHAPE_NAME, {
    x, y, w, h,
    rectRadius: CARD_RADIUS,
    fill: { color: opts?.fillColor || 'FFFFFF', transparency: opts?.transparency ?? 30 },
    line: { color: opts?.borderColor || COLORS.CARD_BORDER, width: 0.5 },
    shadow: CARD_SHADOW,
  });
}

// ─── 헬퍼: 섹션 라벨 뱃지 ───
function addLabelBadge(
  slide: PptxGenJS.Slide,
  text: string,
  x: number, y: number, w: number
) {
  slide.addText(text, {
    x, y, w, h: 0.22,
    ...LABEL_BADGE_OPTS,
    align: 'center',
    valign: 'middle',
  });
}

// ─── 헬퍼: 얇은 악센트 라인 ───
function addAccentLine(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number,
  color?: string
) {
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x, y, w, h: 0,
    line: { color: color || COLORS.GOLD, width: 0.75 },
  });
}

// ─── 헬퍼: 장식 다이아몬드 도트 ───
function addDiamondDot(
  slide: PptxGenJS.Slide,
  x: number, y: number, size: number,
  color?: string
) {
  slide.addShape('diamond' as PptxGenJS.SHAPE_NAME, {
    x: x - size / 2, y: y - size / 2, w: size, h: size,
    fill: { color: color || COLORS.GOLD },
    line: { width: 0 },
  });
}

function addTastingNoteSlide(pptx: PptxGenJS, data: SlideData) {
  const slide = pptx.addSlide();

  // ════════════════════════════════════════════
  // 배경: 따뜻한 크림색
  // ════════════════════════════════════════════
  slide.background = { color: COLORS.BG_CREAM };

  // 좌측 병 영역 배경 패널 (미세한 톤 차이로 공간 분리)
  slide.addShape('rect' as PptxGenJS.SHAPE_NAME, {
    x: 0, y: 0.90, w: 2.10, h: 8.10,
    fill: { color: COLORS.BG_BOTTLE_AREA, transparency: 40 },
    line: { width: 0 },
  });

  // 우측 상단 장식 악센트 바 (버건디 얇은 라인)
  slide.addShape('roundRect' as PptxGenJS.SHAPE_NAME, {
    x: 7.15, y: 0.20, w: 0.06, h: 0.57,
    fill: { color: COLORS.BURGUNDY },
    line: { width: 0 },
    rectRadius: 0.03,
  });

  // ════════════════════════════════════════════
  // HEADER 영역
  // ════════════════════════════════════════════

  // Logo
  try {
    slide.addImage({ data: LOGO_DATA, x: 0.20, y: 0.20, w: 1.49, h: 0.57 });
  } catch { /* logo failed */ }

  // 와이너리 태그라인
  if (data.wineryDescription) {
    const tagline = data.wineryDescription.split(/[.。]/)[0].trim();
    if (tagline) {
      slide.addText(tagline, {
        x: 1.76, y: 0.20, w: 5.20, h: 0.24,
        fontSize: 9, fontFace: FONT_EN, color: COLORS.TEXT_MUTED, italic: true,
      });
    }
  }

  // 헤더 구분선 (버건디 + 골드 이중선)
  addAccentLine(slide, 0.20, 0.84, 7.10, COLORS.BURGUNDY);
  addAccentLine(slide, 0.20, 0.87, 7.10, COLORS.GOLD_LIGHT);

  // ════════════════════════════════════════════
  // 와인명 영역 (강조 카드)
  // ════════════════════════════════════════════

  // 와인명 배경 카드
  addBentoCard(slide, 2.05, 0.97, 5.20, 0.76, {
    fillColor: COLORS.BURGUNDY_LIGHT,
    borderColor: COLORS.CARD_BORDER,
    transparency: 20,
  });

  // 와인명 좌측 악센트 바
  slide.addShape('roundRect' as PptxGenJS.SHAPE_NAME, {
    x: 2.05, y: 1.01, w: 0.05, h: 0.68,
    fill: { color: COLORS.BURGUNDY },
    line: { width: 0 },
    rectRadius: 0.025,
  });

  // 한글명 (앞 영어약어 2자 제거)
  const cleanNameKr = stripKrPrefix(data.nameKr);
  slide.addText(cleanNameKr, {
    x: 2.20, y: 1.00, w: 4.90, h: 0.36,
    fontSize: 14.5, fontFace: FONT_MAIN,
    color: COLORS.BURGUNDY_DARK, bold: true,
    valign: 'bottom',
  });
  // 영문명 (줄바꿈)
  if (data.nameEn) {
    slide.addText(data.nameEn, {
      x: 2.20, y: 1.36, w: 4.90, h: 0.30,
      fontSize: 10.5, fontFace: FONT_MAIN,
      color: COLORS.TEXT_SECONDARY, bold: true, italic: true,
      valign: 'top',
    });
  }

  // ════════════════════════════════════════════
  // 와인 병 이미지
  // ════════════════════════════════════════════
  if (data.bottleImageBase64) {
    try {
      // 이미지 영역: 좌측 패널 내부에 적절한 크기로 배치
      const imgW = 1.50;
      const imgH = 5.80;
      const imgX = 0.30;
      const imgY = 2.20;
      // bottleImageMime은 "image/png" 형태이므로 그대로 사용
      const mime = data.bottleImageMime || 'image/png';
      slide.addImage({
        data: `${mime};base64,${data.bottleImageBase64}`,
        x: imgX, y: imgY, w: imgW, h: imgH,
        sizing: { type: 'contain', w: imgW, h: imgH },
      });
    } catch { /* image failed */ }
  }

  // 와인명 하단 장식 (골드 악센트 + 다이아몬드)
  addAccentLine(slide, 2.20, 1.82, 4.90, COLORS.DIVIDER);
  addDiamondDot(slide, 4.65, 1.82, 0.07, COLORS.GOLD);

  // ════════════════════════════════════════════
  // 와인 상세 정보 (Bento 카드 레이아웃)
  // ════════════════════════════════════════════

  // ─── 지역 & 품종: 상단 카드 ───
  addBentoCard(slide, 2.05, 1.92, 5.20, 0.95, {
    fillColor: 'FFFFFF', transparency: 15,
  });

  // 지역
  addLabelBadge(slide, '  지역  ', 2.12, 1.97, 0.55);
  const regionText = data.region
    ? `${data.countryEn || data.country}, ${data.region}`
    : (data.countryEn || data.country || '-');
  slide.addText(regionText, {
    x: 2.75, y: 1.96, w: 4.40, h: 0.24,
    fontSize: 9.5, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, wrap: true,
  });

  // 카드 내 구분선
  addAccentLine(slide, 2.20, 2.35, 4.90, COLORS.DIVIDER_LIGHT);

  // 품종
  addLabelBadge(slide, '  품종  ', 2.12, 2.42, 0.55);
  slide.addText(data.grapeVarieties || '-', {
    x: 2.75, y: 2.41, w: 4.40, h: 0.40,
    fontSize: 9.5, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, wrap: true, valign: 'top',
  });

  // ─── 빈티지 카드 (연도 강조 + 노트 보조) ───
  addBentoCard(slide, 2.05, 2.96, 5.20, 0.50, {
    fillColor: 'FFFFFF', transparency: 15,
  });

  addLabelBadge(slide, ' 빈티지 ', 2.12, 3.02, 0.65);
  // 빈티지 연도를 4자리로 크게 표시
  const vintageYear = formatVintage4(data.vintage) || '-';
  slide.addText(vintageYear, {
    x: 2.85, y: 2.98, w: 0.75, h: 0.28,
    fontSize: 13, fontFace: FONT_MAIN, color: COLORS.BURGUNDY, bold: true,
  });
  // 빈티지 노트는 연도 옆에 작게
  if (data.vintageNote) {
    slide.addText(data.vintageNote, {
      x: 3.65, y: 3.00, w: 3.50, h: 0.40,
      fontSize: 8, fontFace: FONT_MAIN, color: COLORS.TEXT_SECONDARY, wrap: true, valign: 'top',
    });
  }

  // ─── 양조 카드 ───
  addBentoCard(slide, 2.05, 3.56, 5.20, 1.65, {
    fillColor: 'FFFFFF', transparency: 15,
  });

  addLabelBadge(slide, '  양조  ', 2.12, 3.62, 0.55);
  const wineMakingText = data.winemaking || '-';
  const alcoholLine = data.alcoholPercentage ? `\n알코올: ${data.alcoholPercentage}` : '';
  slide.addText(wineMakingText + alcoholLine, {
    x: 2.15, y: 3.90, w: 5.00, h: 1.23,
    fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, valign: 'top', wrap: true,
    lineSpacingMultiple: 1.2,
  });

  // ─── 테이스팅 노트 카드 (핵심 영역 - 확대) ───
  addBentoCard(slide, 2.05, 5.30, 5.20, 2.72, {
    fillColor: COLORS.BURGUNDY_LIGHT,
    borderColor: COLORS.CARD_BORDER,
    transparency: 30,
  });

  // 테이스팅 노트 라벨
  slide.addText('  TASTING NOTE  ', {
    x: 2.12, y: 5.35, w: 1.32, h: 0.22,
    fill: { color: COLORS.BURGUNDY },
    rectRadius: 0.04,
    color: COLORS.TEXT_ON_DARK,
    fontSize: 7.5, fontFace: FONT_EN, bold: true,
    align: 'center', valign: 'middle',
  });

  // 테이스팅 노트 - 각 항목을 별도 문단으로 분리
  const tastingParts: PptxGenJS.TextProps[] = [];
  const tastingItems = [
    { label: 'Color', value: data.colorNote },
    { label: 'Nose', value: data.noseNote },
    { label: 'Palate', value: data.palateNote },
    { label: 'Potential', value: data.agingPotential },
    { label: 'Serving', value: data.servingTemp },
  ];
  let itemIndex = 0;
  for (const item of tastingItems) {
    if (!item.value) continue;
    tastingParts.push({
      text: `${item.label}`,
      options: {
        fontSize: 8.5, fontFace: FONT_EN, color: COLORS.BURGUNDY,
        bold: true,
        breakType: itemIndex > 0 ? 'break' as const : 'none' as const,
        paraSpaceBefore: itemIndex > 0 ? 6 : 0,
      },
    });
    tastingParts.push({
      text: `\n${item.value}`,
      options: {
        fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY,
        breakType: 'none' as const,
      },
    });
    itemIndex++;
  }
  if (tastingParts.length === 0) {
    tastingParts.push({ text: '-', options: { fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_MUTED } });
  }
  slide.addText(tastingParts, {
    x: 2.15, y: 5.62, w: 5.00, h: 2.32,
    valign: 'top', lineSpacingMultiple: 1.15,
  });

  // ─── 푸드 페어링 카드 ───
  addBentoCard(slide, 2.05, 8.12, 5.20, 0.80, {
    fillColor: 'FFFFFF', transparency: 15,
  });

  addLabelBadge(slide, '푸드 페어링', 2.12, 8.18, 0.95);
  slide.addText(data.foodPairing || '-', {
    x: 2.15, y: 8.42, w: 5.00, h: 0.44,
    fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, wrap: true, valign: 'top',
    lineSpacingMultiple: 1.2,
  });

  // ════════════════════════════════════════════
  // 수상내역 영역 (골드 악센트 밴드)
  // ════════════════════════════════════════════

  // 수상 배경 밴드
  slide.addShape('roundRect' as PptxGenJS.SHAPE_NAME, {
    x: 0.15, y: 9.04, w: 7.20, h: 0.38,
    rectRadius: 0.04,
    fill: { color: COLORS.GOLD, transparency: 85 },
    line: { color: COLORS.GOLD_LIGHT, width: 0.5 },
  });

  // 수상 아이콘
  try {
    slide.addImage({ data: AWARD_ICON_DATA, x: 0.25, y: 9.08, w: 0.22, h: 0.28 });
  } catch { /* icon failed */ }

  // 수상내역 텍스트
  const awardsLabel: PptxGenJS.TextProps[] = [
    {
      text: 'AWARDS  ',
      options: { fontSize: 8, fontFace: FONT_EN, color: COLORS.GOLD, bold: true },
    },
    {
      text: (data.awards && data.awards !== 'N/A') ? data.awards : '',
      options: { fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY },
    },
  ];
  slide.addText(awardsLabel, {
    x: 0.52, y: 9.07, w: 6.70, h: 0.30,
    valign: 'middle',
  });

  // ════════════════════════════════════════════
  // FOOTER 영역 (세련된 버건디 라인)
  // ════════════════════════════════════════════

  // 버건디 실선 + 골드 보조선
  slide.addShape('line' as PptxGenJS.SHAPE_NAME, {
    x: 0.20, y: 9.52, w: 7.10, h: 0,
    line: { color: COLORS.BURGUNDY, width: 2.0 },
  });
  addAccentLine(slide, 0.20, 9.55, 7.10, COLORS.GOLD_LIGHT);

  // 로고
  try {
    slide.addImage({ data: LOGO_DATA, x: 0.09, y: 9.68, w: 0.95, h: 0.25 });
  } catch { /* logo failed */ }

  // 회사 정보
  slide.addText('T. 02-786-3136  |  www.cavedevin.co.kr', {
    x: 1.12, y: 9.69, w: 2.76, h: 0.24,
    fontSize: 7, fontFace: FONT_EN, color: COLORS.TEXT_MUTED, align: 'right',
  });

  // 우측 하단 장식 다이아몬드
  addDiamondDot(slide, 7.20, 9.80, 0.06, COLORS.GOLD);
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

    // 이미지: 비활성화 (디버그 - PPT 열림 여부 확인)
    const bottleImageBase64: string | undefined = undefined;
    const bottleImageMime: string | undefined = undefined;

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

  logger.info(`PPT generated: ${slideCount} slides (enhanced design)`);

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
