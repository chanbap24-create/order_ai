// app/api/admin/tasting-notes/generate-ppt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateTastingNotePpt, generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { logChange } from "@/app/lib/changeLogDb";
import { upsertTastingNote } from "@/app/lib/wineDb";
import { uploadToRelease } from "@/app/lib/githubRelease";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { wineIds } = await request.json();

    if (!Array.isArray(wineIds) || wineIds.length === 0) {
      return NextResponse.json({ success: false, error: "wineIds 배열이 필요합니다." }, { status: 400 });
    }

    // 개별 와인별 PPTX 생성 + GitHub 릴리스 업로드
    const uploadResults: { wineId: string; url?: string; error?: string }[] = [];

    for (const wineId of wineIds) {
      try {
        const buf = await generateSingleWinePpt(wineId);
        upsertTastingNote(wineId, { ppt_generated: 1 });

        // GitHub 릴리스 업로드
        try {
          const url = await uploadToRelease(
            `${wineId}.pptx`,
            buf,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          );
          uploadResults.push({ wineId, url });
        } catch (e) {
          logger.warn(`[PPT] GitHub upload failed for ${wineId}`, { error: e });
          uploadResults.push({ wineId, error: "GitHub 업로드 실패" });
        }
      } catch (e) {
        uploadResults.push({ wineId, error: e instanceof Error ? e.message : "생성 실패" });
      }
    }

    logChange('ppt_generated', 'tasting_note', wineIds.join(','), { count: wineIds.length });

    // 단일 와인이면 PPTX 파일도 직접 다운로드
    if (wineIds.length === 1) {
      const pptBuffer = await generateSingleWinePpt(wineIds[0]);
      return new NextResponse(new Uint8Array(pptBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${wineIds[0]}.pptx"`,
          'X-Upload-Results': JSON.stringify(uploadResults),
        },
      });
    }

    // 여러 와인이면 통합 PPTX + 개별 업로드 결과
    const bulkBuffer = await generateTastingNotePpt(wineIds);
    return new NextResponse(new Uint8Array(bulkBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="tasting-notes-bulk.pptx"`,
        'X-Upload-Results': JSON.stringify(uploadResults),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
