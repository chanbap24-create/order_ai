// app/api/admin/tasting-notes/generate-ppt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt, generateTastingNotePpt } from "@/app/lib/pptGenerator";
import { logChange } from "@/app/lib/changeLogDb";
import { upsertTastingNote } from "@/app/lib/wineDb";
import { uploadToRelease } from "@/app/lib/githubRelease";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { wineIds } = await request.json();

    if (!Array.isArray(wineIds) || wineIds.length === 0) {
      return NextResponse.json({ success: false, error: "wineIds 배열이 필요합니다." }, { status: 400 });
    }

    // PPTX 생성
    let pptBuffer: Buffer;
    try {
      if (wineIds.length === 1) {
        pptBuffer = await generateSingleWinePpt(wineIds[0]);
      } else {
        pptBuffer = await generateTastingNotePpt(wineIds);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PPT 생성 실패";
      logger.error(`[PPT] Generation failed`, { error: e });
      return NextResponse.json({ success: false, error: `PPT 생성 실패: ${msg}` }, { status: 500 });
    }

    // DB 업데이트
    for (const wineId of wineIds) {
      try {
        upsertTastingNote(wineId, { ppt_generated: 1 });
      } catch { /* ignore */ }
    }

    // GitHub 릴리스 업로드 (백그라운드, 실패해도 다운로드에는 영향 없음)
    const uploadResults: { wineId: string; pptxUrl?: string; error?: string }[] = [];
    for (const wineId of wineIds) {
      try {
        const singleBuf = wineIds.length === 1 ? pptBuffer : await generateSingleWinePpt(wineId);
        const url = await uploadToRelease(
          `${wineId}.pptx`,
          singleBuf,
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        );
        uploadResults.push({ wineId, pptxUrl: url });
      } catch (e) {
        logger.warn(`[PPT] GitHub upload failed for ${wineId}`, { error: e });
        uploadResults.push({ wineId, error: "GitHub 업로드 실패" });
      }
    }

    logChange('ppt_generated', 'tasting_note', wineIds.join(','), { count: wineIds.length });

    const fileName = wineIds.length === 1 ? `${wineIds[0]}.pptx` : "tasting-notes-bulk.pptx";

    return new NextResponse(new Uint8Array(pptBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Upload-Results': JSON.stringify(uploadResults),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[PPT Route] Unhandled error`, { error: e });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
