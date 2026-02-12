// app/api/admin/tasting-notes/generate-ppt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt, generateTastingNotePpt } from "@/app/lib/pptGenerator";
import { logChange } from "@/app/lib/changeLogDb";
import { upsertTastingNote } from "@/app/lib/wineDb";
import { savePptx, convertToPdf } from "@/app/lib/fileOutput";
import { logger } from "@/app/lib/logger";

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

    // 파일 저장 + PDF 변환
    for (const wineId of wineIds) {
      if (wineIds.length === 1) {
        const pptxPath = savePptx(wineId, pptBuffer);
        convertToPdf(pptxPath);
      }
    }

    // 일괄 생성 시 개별 파일도 저장
    if (wineIds.length > 1) {
      for (const wineId of wineIds) {
        try {
          const singleBuffer = await generateSingleWinePpt(wineId);
          const pptxPath = savePptx(wineId, singleBuffer);
          convertToPdf(pptxPath);
        } catch {
          logger.warn(`[PPT] Individual save failed for ${wineId}`);
        }
      }
    }

    // DB 업데이트
    for (const wineId of wineIds) {
      try {
        await upsertTastingNote(wineId, { ppt_generated: 1 });
      } catch { /* ignore */ }
    }

    try {
      await logChange('ppt_generated', 'tasting_note', wineIds.join(','), { count: wineIds.length });
    } catch { /* ignore */ }

    const fileName = wineIds.length === 1 ? `${wineIds[0]}.pptx` : "tasting-notes-bulk.pptx";

    // Buffer를 직접 Response로 반환
    return new Response(pptBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pptBuffer.length),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[PPT Route] Unhandled error`, { error: e });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
