// app/api/admin/tasting-notes/download/[id]/route.ts
// 개별 와인 PPTX/PDF 다운로드
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { generateSingleWinePdf } from "@/app/lib/pdfGenerator";
import { readOutputFile, savePptx } from "@/app/lib/fileOutput";
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

    let buffer: Buffer | null = null;

    if (format === "pptx") {
      buffer = readOutputFile(wineId, "pptx");
      if (!buffer) {
        const pptBuffer = await generateSingleWinePpt(wineId);
        savePptx(wineId, pptBuffer);
        buffer = pptBuffer;
      }
    } else {
      // PDF: Python reportlab으로 직접 생성 (PPTX와 동일한 디자인)
      buffer = await generateSingleWinePdf(wineId);
    }

    if (!buffer) {
      return NextResponse.json(
        { success: false, error: "파일 생성 실패" },
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
