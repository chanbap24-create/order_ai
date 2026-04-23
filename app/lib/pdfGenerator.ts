// PDF 생성기 - pdfkit 기반 (Vercel 서버리스 호환)
// Python reportlab (child_process) → pdfkit (pure JS) 마이그레이션

import PDFDocument from "pdfkit";
import { logger } from "@/app/lib/logger";

import { i, PAGE_W, PAGE_H } from "./pdf-generator/theme";
import { ensureKoreanFont } from "./pdf-generator/fonts";
import { renderPage } from "./pdf-generator/renderPage";
import { buildSlidesFromWineIds } from "./pdf-generator/slideBuilder";

/** 단일 와인 PDF 생성 */
export async function generateSingleWinePdf(wineId: string): Promise<Buffer> {
  return generateTastingNotePdf([wineId]);
}

/** 여러 와인의 테이스팅 노트 PDF 생성 */
export async function generateTastingNotePdf(wineIds: string[]): Promise<Buffer> {
  const slides = await buildSlidesFromWineIds(wineIds);

  if (slides.length === 0) {
    throw new Error("생성할 페이지가 없습니다.");
  }

  // 한국어 폰트 준비
  const fonts = await ensureKoreanFont();

  // PDF 생성
  const doc = new PDFDocument({
    size: [i(PAGE_W), i(PAGE_H)],
    margin: 0,
    autoFirstPage: false,
  });

  // 폰트 등록
  let fontRegular = "Helvetica";
  let fontBold = "Helvetica-Bold";
  const fontEn = "Times-Italic";

  if (fonts) {
    try {
      doc.registerFont("Korean", fonts.regular);
      doc.registerFont("KoreanBold", fonts.bold);
      fontRegular = "Korean";
      fontBold = "KoreanBold";
    } catch (e) {
      logger.warn(`[PDF] Font registration failed, using Helvetica: ${e}`);
    }
  }

  // Buffer 수집
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // 페이지 렌더링
  for (const data of slides) {
    doc.addPage();
    renderPage(doc, data, fontRegular, fontBold, fontEn);
  }

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      logger.info(`[PDF] Generated: ${slides.length} pages (pdfkit, ${pdfBuffer.length} bytes)`);
      resolve(pdfBuffer);
    });
    doc.on("error", reject);
  });
}
