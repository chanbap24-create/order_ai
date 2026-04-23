// app/api/admin/tasting-notes/download-zip/route.ts
// 여러 와인 PPTX를 ZIP으로 일괄 다운로드
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { readOutputFile, savePptx, convertToPdf } from "@/app/lib/fileOutput";
import { logger } from "@/app/lib/logger";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { wineIds, format = "pptx" } = await request.json();

    if (!Array.isArray(wineIds) || wineIds.length === 0) {
      return NextResponse.json({ success: false, error: "wineIds 배열이 필요합니다." }, { status: 400 });
    }

    const zip = new JSZip();
    let addedCount = 0;

    // PPT 생성은 CPU/메모리 부하가 크므로 3개씩만 병렬 (기존: 1개씩 순차)
    const CONCURRENCY = 3;
    for (let i = 0; i < wineIds.length; i += CONCURRENCY) {
      const batch = wineIds.slice(i, i + CONCURRENCY);
      const entries = await Promise.all(
        batch.map(async (wineId: string) => {
          try {
            let pptxBuffer = readOutputFile(wineId, "pptx");
            if (!pptxBuffer) {
              pptxBuffer = await generateSingleWinePpt(wineId);
              const pptxPath = savePptx(wineId, pptxBuffer);
              convertToPdf(pptxPath);
            }

            if (format === "pdf") {
              const pdfBuffer = readOutputFile(wineId, "pdf");
              if (pdfBuffer) return { name: `${wineId}.pdf`, buf: pdfBuffer };
              // PDF 없으면 PPTX 포함
              return { name: `${wineId}.pptx`, buf: pptxBuffer };
            }
            return { name: `${wineId}.pptx`, buf: pptxBuffer };
          } catch (e) {
            logger.warn(`[ZIP] Skipping ${wineId}`, { error: e });
            return null;
          }
        }),
      );
      for (const entry of entries) {
        if (entry) {
          zip.file(entry.name, entry.buf);
          addedCount++;
        }
      }
    }

    if (addedCount === 0) {
      return NextResponse.json({ success: false, error: "ZIP에 추가할 파일이 없습니다." }, { status: 404 });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="tasting-notes-${wineIds.length}wines.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[ZIP] Error`, { error: e });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
