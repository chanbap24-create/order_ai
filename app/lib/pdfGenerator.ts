// PDF 생성기 - pdfkit 사용
// pptGenerator.ts와 동일한 레이아웃을 PDF로 직접 생성 (LibreOffice 불필요)

import PDFDocument from "pdfkit";
import { existsSync } from "fs";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64 } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

// 슬라이드 크기 (인치) → 포인트 (1in = 72pt)
const SLIDE_W = 7.5 * 72; // 540pt
const SLIDE_H = 10.0 * 72; // 720pt
const I = 72; // 1 inch in points

// 폰트 경로
const FONT_REGULAR = "C:\\Windows\\Fonts\\malgun.ttf";
const FONT_BOLD = "C:\\Windows\\Fonts\\malgunbd.ttf";

interface PdfSlideData {
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
}

function registerFonts(doc: PDFKit.PDFDocument) {
  if (existsSync(FONT_REGULAR)) {
    doc.registerFont("MalgunGothic", FONT_REGULAR);
    // Turbopack이 pdfkit 내장 Helvetica.afm 경로를 C:\ROOT\로 변환하는 문제 우회
    // 'Helvetica'를 맑은 고딕으로 덮어씌워 AFM 로드를 방지
    doc.registerFont("Helvetica", FONT_REGULAR);
  }
  if (existsSync(FONT_BOLD)) {
    doc.registerFont("MalgunGothicBold", FONT_BOLD);
    doc.registerFont("Helvetica-Bold", FONT_BOLD);
  }
}

function addPage(doc: PDFKit.PDFDocument, data: PdfSlideData) {
  doc.addPage({ size: [SLIDE_W, SLIDE_H], margin: 0 });

  const hasFonts = existsSync(FONT_REGULAR);
  const fontR = hasFonts ? "MalgunGothic" : "Helvetica";
  const fontB = hasFonts ? "MalgunGothicBold" : "Helvetica-Bold";

  // ═══════════════════════════════
  // HEADER
  // ═══════════════════════════════

  // Logo (0.20in, 0.20in, 1.49x0.57in)
  try {
    const logoBuffer = Buffer.from(LOGO_CAVEDEVIN_BASE64, "base64");
    doc.image(logoBuffer, 0.20 * I, 0.20 * I, { width: 1.49 * I, height: 0.57 * I });
  } catch { /* logo failed */ }

  // 와이너리 태그라인 (1.66in, 0.18in, 10pt italic)
  if (data.wineryDescription) {
    const tagline = data.wineryDescription.split(/[.。]/)[0].trim();
    if (tagline) {
      doc.font(fontR).fontSize(10).fillColor("#000000")
        .text(tagline, 1.66 * I, 0.18 * I, { width: 4.45 * I, lineBreak: false });
    }
  }

  // 헤더 구분선 (0.21in, 0.84in, w=7.09in, 0.5pt)
  doc.strokeColor("#000000").lineWidth(0.5)
    .moveTo(0.21 * I, 0.84 * I)
    .lineTo((0.21 + 7.09) * I, 0.84 * I)
    .stroke();

  // ═══════════════════════════════
  // 와인명 (2.12in, 1.08in)
  // ═══════════════════════════════
  doc.font(fontR).fontSize(14.5).fillColor("#000000")
    .text(data.nameKr, 2.12 * I, 1.08 * I, { width: 4.21 * I });

  if (data.nameEn) {
    const nameY = doc.y + 2;
    doc.font(fontB).fontSize(11).fillColor("#000000")
      .text(data.nameEn, 2.12 * I, nameY, { width: 4.21 * I });
  }

  // ═══════════════════════════════
  // 와인 병 이미지 (0, 1.62in, 2.13x7.73in)
  // ═══════════════════════════════
  if (data.bottleImageBase64) {
    try {
      const imgBuffer = Buffer.from(data.bottleImageBase64, "base64");
      doc.image(imgBuffer, 0, 1.62 * I, {
        fit: [2.13 * I, 7.73 * I],
        align: "center",
        valign: "center",
      });
    } catch { /* image failed */ }
  }

  // 와인명 하단 점선 (2.19in, 1.82in, w=3.28in)
  doc.strokeColor("#000000").lineWidth(1.5)
    .dash(3, { space: 3 })
    .moveTo(2.19 * I, 1.82 * I)
    .lineTo((2.19 + 3.28) * I, 1.82 * I)
    .stroke()
    .undash();

  // ═══════════════════════════════
  // 와인 상세 정보
  // ═══════════════════════════════

  // 지역
  doc.font(fontB).fontSize(11).fillColor("#000000")
    .text("지역", 2.10 * I, 1.93 * I);
  const regionText = data.region
    ? `${data.countryEn || data.country}, ${data.region}`
    : (data.countryEn || data.country || "-");
  doc.font(fontR).fontSize(10)
    .text(regionText, 2.10 * I, 2.13 * I, { width: 4.24 * I });

  // 품종
  doc.font(fontB).fontSize(11)
    .text("품종", 2.12 * I, 2.42 * I);
  doc.font(fontR).fontSize(10)
    .text(data.grapeVarieties || "-", 2.12 * I, 2.71 * I, { width: 4.33 * I });

  // 빈티지
  doc.font(fontB).fontSize(11)
    .text("빈티지", 2.12 * I, 3.02 * I);
  doc.font(fontR).fontSize(10)
    .text(data.vintageNote || data.vintage || "-", 2.10 * I, 3.29 * I, { width: 4.86 * I });

  // 양조
  doc.font(fontB).fontSize(11)
    .text("양조", 2.14 * I, 3.82 * I);
  const wineMakingText = data.winemaking || "-";
  const alcoholLine = data.alcoholPercentage ? `\n알코올: ${data.alcoholPercentage}` : "";
  doc.font(fontR).fontSize(9)
    .text(wineMakingText + alcoholLine, 2.13 * I, 4.11 * I, { width: 5.16 * I, height: 1.21 * I });

  // 테이스팅 노트
  doc.font(fontB).fontSize(11)
    .text("테이스팅 노트", 2.10 * I, 5.63 * I);
  const tastingLines: string[] = [];
  if (data.colorNote) tastingLines.push(`컬러: ${data.colorNote}`);
  if (data.noseNote) tastingLines.push(`노즈: ${data.noseNote}`);
  if (data.palateNote) tastingLines.push(`팔렛: ${data.palateNote}`);
  if (data.agingPotential) tastingLines.push(`잠재력: ${data.agingPotential}`);
  if (data.servingTemp) tastingLines.push(`서빙 온도: ${data.servingTemp}`);
  doc.font(fontR).fontSize(9)
    .text(tastingLines.join("\n") || "-", 2.14 * I, 5.86 * I, { width: 5.16 * I, height: 1.43 * I });

  // 푸드 페어링
  doc.font(fontB).fontSize(11)
    .text("푸드 페어링", 2.13 * I, 7.36 * I);
  doc.font(fontR).fontSize(9)
    .text(data.foodPairing || "-", 2.13 * I, 7.70 * I, { width: 5.25 * I });

  // 글라스 페어링
  doc.font(fontB).fontSize(11)
    .text("글라스 페어링", 2.10 * I, 8.15 * I);
  doc.font(fontR).fontSize(9)
    .text(data.glassPairing || "-", 2.10 * I, 8.49 * I, { width: 5.58 * I, height: 0.56 * I });

  // ═══════════════════════════════
  // 수상내역
  // ═══════════════════════════════
  doc.strokeColor("#000000").lineWidth(1.5)
    .dash(3, { space: 3 })
    .moveTo(0.26 * I, 9.06 * I)
    .lineTo((0.26 + 7.09) * I, 9.06 * I)
    .stroke()
    .undash();

  // 수상 아이콘
  try {
    const iconBuffer = Buffer.from(ICON_AWARD_BASE64, "base64");
    doc.image(iconBuffer, 0.30 * I, 9.13 * I, { width: 0.20 * I, height: 0.25 * I });
  } catch { /* icon failed */ }

  // 수상내역 텍스트
  const awardsText = data.awards && data.awards !== "N/A"
    ? `수상내역  ${data.awards}`
    : "수상내역";
  doc.font(fontR).fontSize(10).fillColor("#000000")
    .text(awardsText, 0.51 * I, 9.16 * I, { width: 6.5 * I });

  // ═══════════════════════════════
  // FOOTER
  // ═══════════════════════════════
  doc.strokeColor("#000000").lineWidth(3)
    .moveTo(0.21 * I, 9.52 * I)
    .lineTo((0.21 + 7.09) * I, 9.52 * I)
    .stroke();

  // 로고
  try {
    const logoBuffer = Buffer.from(LOGO_CAVEDEVIN_BASE64, "base64");
    doc.image(logoBuffer, 0.09 * I, 9.70 * I, { width: 0.95 * I, height: 0.25 * I });
  } catch { /* logo failed */ }

  // 회사 정보
  doc.font(fontR).fontSize(7.5).fillColor("#000000")
    .text("㈜까브드뱅   T. 02-786-3136 |  www.cavedevin.co.kr", 1.12 * I, 9.73 * I, {
      width: 2.76 * I,
      align: "right",
    });
}

/** 단일 와인 PDF 생성 */
export async function generateSingleWinePdf(wineId: string): Promise<Buffer> {
  return generateTastingNotePdf([wineId]);
}

/** 여러 와인의 테이스팅 노트 PDF 생성 */
export async function generateTastingNotePdf(wineIds: string[]): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [SLIDE_W, SLIDE_H],
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
    info: { Author: "까브드뱅 와인 관리 시스템", Title: "Tasting Notes" },
  });

  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  let slideCount = 0;

  for (const wineId of wineIds) {
    const wine = getWineByCode(wineId);
    if (!wine) continue;

    const note = getTastingNote(wineId);

    let bottleImageBase64: string | undefined;
    if (wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) bottleImageBase64 = imgData.base64;
      } catch {
        logger.warn(`[PDF] Image download failed for ${wineId}`);
      }
    }

    addPage(doc, {
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || "",
      country: wine.country || "",
      countryEn: wine.country_en || "",
      region: wine.region || "",
      grapeVarieties: wine.grape_varieties || "",
      vintage: wine.vintage || "",
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
    });
    slideCount++;
  }

  if (slideCount === 0) {
    throw new Error("생성할 페이지가 없습니다.");
  }

  logger.info(`[PDF] Generated: ${slideCount} pages`);

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
