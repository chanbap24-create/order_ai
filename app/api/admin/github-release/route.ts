// app/api/admin/github-release/route.ts
// 승인된 와인 PPTX 또는 PDF를 GitHub 릴리스에 업로드
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { generateSingleWinePdf } from "@/app/lib/pdfGenerator";
import { readOutputFile, savePptx } from "@/app/lib/fileOutput";
import { uploadToRelease, refreshReleaseIndex } from "@/app/lib/githubRelease";
import { getWineByCode } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { logger } from "@/app/lib/logger";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json(
        { success: false, error: "GITHUB_TOKEN 환경변수가 설정되지 않았습니다." },
        { status: 400 }
      );
    }

    const { wineIds, format = "pptx" } = await request.json();

    if (!Array.isArray(wineIds) || wineIds.length === 0) {
      return NextResponse.json({ success: false, error: "wineIds 배열이 필요합니다." }, { status: 400 });
    }

    const results: { wineId: string; url?: string; error?: string }[] = [];

    for (const wineId of wineIds) {
      try {
        const wine = await getWineByCode(wineId);
        if (!wine) {
          results.push({ wineId, error: "와인 정보 없음" });
          continue;
        }

        let buffer: Buffer;
        let fileName: string;
        let contentType: string;

        if (format === "pdf") {
          buffer = await generateSingleWinePdf(wineId);
          fileName = `${wineId}.pdf`;
          contentType = "application/pdf";
        } else {
          // PPTX
          let pptxBuffer = readOutputFile(wineId, "pptx");
          if (!pptxBuffer) {
            pptxBuffer = await generateSingleWinePpt(wineId);
            savePptx(wineId, pptxBuffer);
          }
          buffer = pptxBuffer;
          fileName = `${wineId}.pptx`;
          contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        }

        const url = await uploadToRelease(fileName, buffer, contentType);
        results.push({ wineId, url });
        logger.info(`[GitHub] Uploaded ${fileName} (${buffer.length} bytes)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ wineId, error: msg });
        logger.warn(`[GitHub] Upload failed for ${wineId} (${format}): ${msg}`);
      }
    }

    try {
      await logChange("github_release", "tasting_note", wineIds.join(","), {
        format,
        count: wineIds.length,
        success: results.filter((r) => !r.error).length,
      });
    } catch { /* ignore */ }

    // PDF 업로드 성공 시 인덱스 자동 갱신
    const uploadedCount = results.filter((r) => !r.error).length;
    let indexTotal = 0;
    if (uploadedCount > 0 && format === "pdf") {
      try {
        const indexResult = await refreshReleaseIndex();
        indexTotal = indexResult.total;
        logger.info(`[GitHub] Index refreshed after upload: ${indexTotal} items`);
      } catch (e) {
        logger.warn(`[GitHub] Index refresh failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    return NextResponse.json({
      success: true,
      format,
      results,
      uploaded: uploadedCount,
      failed: results.filter((r) => r.error).length,
      indexTotal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[GitHub Release] Error: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
