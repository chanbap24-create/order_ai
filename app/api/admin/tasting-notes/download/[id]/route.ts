// app/api/admin/tasting-notes/download/[id]/route.ts
// 개별 와인 PPTX/PDF 다운로드
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { readOutputFile, savePptx, convertToPdf } from "@/app/lib/fileOutput";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wineId } = await params;
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "pptx") as "pptx" | "pdf";

    // 저장된 파일 확인
    let buffer = readOutputFile(wineId, format);

    // PPTX가 없으면 새로 생성
    if (!buffer && format === "pptx") {
      const pptBuffer = await generateSingleWinePpt(wineId);
      const pptxPath = savePptx(wineId, pptBuffer);
      convertToPdf(pptxPath);
      buffer = pptBuffer;
    }

    // PDF가 없으면 PPTX에서 변환 시도
    if (!buffer && format === "pdf") {
      let pptxBuffer = readOutputFile(wineId, "pptx");
      if (!pptxBuffer) {
        pptxBuffer = await generateSingleWinePpt(wineId);
        savePptx(wineId, pptxBuffer);
      }
      const pptxPath = savePptx(wineId, pptxBuffer);
      const pdfPath = convertToPdf(pptxPath);
      if (pdfPath) {
        buffer = readOutputFile(wineId, "pdf");
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { success: false, error: format === "pdf" ? "PDF 변환 불가 (LibreOffice 필요)" : "파일 생성 실패" },
        { status: 404 }
      );
    }

    const contentType = format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${wineId}.${format}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[Download] Error`, { error: e });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
