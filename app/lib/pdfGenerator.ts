// PDF 생성기 - pdfkit 사용
// 테이스팅 노트 PDF 생성

import PDFDocument from "pdfkit";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { logger } from "@/app/lib/logger";
import path from "path";
import fs from "fs";

const PRIMARY_COLOR = "#8B1538";
const TEXT_COLOR = "#1A1A1A";
const LIGHT_TEXT = "#666666";
const ACCENT_BG = "#F8F4F0";
const AWARDS_BG = "#FFF8E1";

// 한글 폰트 경로 (Vercel/시스템 폰트)
function getFontPath(fontName: string): string | null {
  const candidates = [
    // Windows
    `C:/Windows/Fonts/${fontName}`,
    // Project local
    path.join(process.cwd(), `fonts/${fontName}`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

interface NoteData {
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

function addTastingNotePage(doc: PDFKit.PDFDocument, data: NoteData, isFirst: boolean) {
  if (!isFirst) doc.addPage();

  const pageW = doc.page.width;
  const margin = 40;
  const contentW = pageW - margin * 2;

  // 상단 바
  doc.rect(0, 0, pageW, 65).fill(PRIMARY_COLOR);

  // 와인명 (한글)
  doc.font("KoreanFont").fontSize(18).fillColor("white");
  doc.text(data.nameKr, margin, 12, { width: contentW, height: 28 });

  // 와인명 (영문)
  if (data.nameEn) {
    doc.font("KoreanFont").fontSize(10).fillColor("#DDBBBB");
    doc.text(data.nameEn, margin, 40, { width: contentW, height: 20 });
  }

  // 기본 정보
  let y = 80;

  // 국가/지역
  doc.font("KoreanFont").fontSize(9).fillColor(LIGHT_TEXT);
  doc.text("국가  ", margin, y, { continued: true });
  doc.fontSize(10).fillColor(TEXT_COLOR);
  doc.text(`${data.country}${data.region ? " - " + data.region : ""}`, { lineBreak: false });

  y += 22;
  doc.font("KoreanFont").fontSize(9).fillColor(LIGHT_TEXT);
  doc.text("품종  ", margin, y, { continued: true });
  doc.fontSize(10).fillColor(TEXT_COLOR);
  doc.text(data.grapeVarieties || "-", { lineBreak: false });

  y += 22;
  doc.font("KoreanFont").fontSize(9).fillColor(LIGHT_TEXT);
  doc.text("빈티지  ", margin, y, { continued: true });
  doc.fontSize(10).fillColor(TEXT_COLOR);
  doc.text(data.vintage || "-", { continued: true, lineBreak: false });
  doc.fontSize(9).fillColor(LIGHT_TEXT);
  doc.text("    타입  ", { continued: true, lineBreak: false });
  doc.fontSize(10).fillColor(TEXT_COLOR);
  doc.text(data.wineType || "-", { lineBreak: false });

  // 양조
  if (data.winemaking) {
    y += 30;
    doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
    doc.text("양조", margin, y);
    y += 14;
    doc.fontSize(8.5).fillColor(TEXT_COLOR);
    doc.text(data.winemaking, margin, y, { width: contentW * 0.5, lineGap: 2 });
    y = doc.y + 10;
  } else {
    y += 30;
  }

  // 테이스팅 노트 영역
  const noteY = Math.max(y, 190);
  const noteX = margin;
  const noteW = contentW;

  // 배경 박스
  doc.roundedRect(noteX - 5, noteY - 5, noteW + 10, 280, 5).fill(ACCENT_BG);

  doc.font("KoreanFont").fontSize(12).fillColor(PRIMARY_COLOR);
  doc.text("TASTING NOTES", noteX, noteY + 5, { width: noteW });

  let ny = noteY + 28;

  // Color
  doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
  doc.text("Color", noteX, ny, { continued: true });
  doc.fillColor(TEXT_COLOR).fontSize(9);
  doc.text("  " + (data.colorNote || "-"), { width: noteW - 50 });
  ny = doc.y + 8;

  // Nose
  doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
  doc.text("Nose", noteX, ny, { continued: true });
  doc.fillColor(TEXT_COLOR).fontSize(9);
  doc.text("  " + (data.noseNote || "-"), { width: noteW - 50 });
  ny = doc.y + 8;

  // Palate
  doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
  doc.text("Palate", noteX, ny, { continued: true });
  doc.fillColor(TEXT_COLOR).fontSize(9);
  doc.text("  " + (data.palateNote || "-"), { width: noteW - 50 });
  ny = doc.y + 8;

  // Food Pairing
  doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
  doc.text("Food Pairing", noteX, ny, { continued: true });
  doc.fillColor(TEXT_COLOR).fontSize(9);
  doc.text("  " + (data.foodPairing || "-"), { width: noteW - 50 });
  ny = doc.y + 8;

  // Glass & Temp
  doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
  doc.text("Glass  ", noteX, ny, { continued: true });
  doc.fillColor(TEXT_COLOR);
  doc.text((data.glassPairing || "-"), { continued: true, lineBreak: false });
  doc.fillColor(PRIMARY_COLOR);
  doc.text("    Temp  ", { continued: true, lineBreak: false });
  doc.fillColor(TEXT_COLOR);
  doc.text(data.servingTemp || "-", { lineBreak: false });
  ny = doc.y + 15;

  // 수상내역
  if (data.awards && data.awards !== "N/A") {
    doc.roundedRect(margin - 5, ny, noteW + 10, 30, 3).fill(AWARDS_BG);
    doc.font("KoreanFont").fontSize(9).fillColor(PRIMARY_COLOR);
    doc.text("Awards  ", margin, ny + 8, { continued: true });
    doc.fillColor(TEXT_COLOR);
    doc.text(data.awards, { width: noteW - 60 });
    ny = doc.y + 10;
  }

  // 하단 바
  const footerY = doc.page.height - 40;
  doc.rect(0, footerY, pageW, 40).fill(PRIMARY_COLOR);
  doc.font("KoreanFont").fontSize(9).fillColor("white");
  doc.text(
    "㈜까브드뱅  T.02-786-3136  |  www.cavedevin.co.kr",
    0, footerY + 12,
    { width: pageW, align: "center" }
  );
}

/** 단일 와인 테이스팅 노트 PDF 생성 → Buffer 반환 */
export async function generateSingleWinePdf(wineId: string): Promise<Buffer> {
  return generateTastingNotePdf([wineId]);
}

/** 여러 와인의 테이스팅 노트 PDF 생성 → Buffer 반환 */
export async function generateTastingNotePdf(wineIds: string[]): Promise<Buffer> {
  // 한글 폰트 로드
  const malgunPath = getFontPath("malgun.ttf");

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: { Author: "까브드뱅 와인 관리 시스템", Title: "Tasting Notes" },
  });

  // 한글 폰트 등록
  if (malgunPath) {
    doc.registerFont("KoreanFont", malgunPath);
  } else {
    // 폰트가 없으면 기본 Helvetica 사용 (한글 깨질 수 있음)
    doc.registerFont("KoreanFont", "Helvetica");
  }

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  let slideCount = 0;

  for (const wineId of wineIds) {
    const wine = getWineByCode(wineId);
    if (!wine) continue;

    const note = getTastingNote(wineId);

    addTastingNotePage(doc, {
      itemCode: wine.item_code,
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || "",
      country: wine.country_en || wine.country || "",
      region: wine.region || "",
      grapeVarieties: wine.grape_varieties || "",
      vintage: wine.vintage || "",
      wineType: wine.wine_type || "",
      winemaking: note?.winemaking || "",
      colorNote: note?.color_note || "",
      noseNote: note?.nose_note || "",
      palateNote: note?.palate_note || "",
      foodPairing: note?.food_pairing || "",
      glassPairing: note?.glass_pairing || "",
      servingTemp: note?.serving_temp || "",
      awards: note?.awards || "",
    }, slideCount === 0);
    slideCount++;
  }

  if (slideCount === 0) {
    throw new Error("생성할 페이지가 없습니다.");
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const result = Buffer.concat(chunks);
      logger.info(`PDF generated: ${slideCount} pages (${result.length} bytes)`);
      resolve(result);
    });
    doc.on("error", reject);
  });
}
