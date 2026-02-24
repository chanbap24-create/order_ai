// app/api/admin/github-release/route.ts
// 승인된 와인 PPTX 또는 PDF를 GitHub 릴리스에 업로드
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { generateSingleWinePdf } from "@/app/lib/pdfGenerator";
import { savePptx } from "@/app/lib/fileOutput";
import { uploadBatchToRelease, refreshReleaseIndex } from "@/app/lib/githubRelease";
import { getWineByCode } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { logger } from "@/app/lib/logger";

export const maxDuration = 300;

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

    // 1단계: 모든 파일 생성
    const files: { wineId: string; fileName: string; buffer: Buffer; contentType: string }[] = [];
    const genErrors: { wineId: string; error: string }[] = [];

    for (const wineId of wineIds) {
      try {
        const wine = await getWineByCode(wineId);
        if (!wine) {
          genErrors.push({ wineId, error: "와인 정보 없음" });
          continue;
        }

        if (format === "pdf") {
          const buffer = await generateSingleWinePdf(wineId);
          files.push({ wineId, fileName: `${wineId}.pdf`, buffer, contentType: "application/pdf" });
        } else {
          const buffer = await generateSingleWinePpt(wineId);
          savePptx(wineId, buffer);
          files.push({ wineId, fileName: `${wineId}.pptx`, buffer, contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
        }
        logger.info(`[GitHub] Generated ${wineId}.${format} (${files[files.length - 1].buffer.length} bytes)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        genErrors.push({ wineId, error: `생성 실패: ${msg}` });
        logger.warn(`[GitHub] Generation failed for ${wineId}: ${msg}`);
      }
    }

    // 2단계: 일괄 업로드 (릴리스/에셋 목록 1회 조회)
    const uploadResults = files.length > 0
      ? await uploadBatchToRelease(files.map(f => ({ fileName: f.fileName, buffer: f.buffer, contentType: f.contentType })))
      : [];

    // 결과 합치기
    const results = [
      ...genErrors.map(e => ({ wineId: e.wineId, error: e.error })),
      ...files.map((f, i) => ({
        wineId: f.wineId,
        url: uploadResults[i]?.url,
        error: uploadResults[i]?.error,
      })),
    ];

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
