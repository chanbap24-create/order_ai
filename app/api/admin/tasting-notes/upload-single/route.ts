// app/api/admin/tasting-notes/upload-single/route.ts
// 단일 와인의 사용자 업로드 파일(PDF/PPTX)을 GitHub Release 에 업로드.
// 파일명은 항상 {wineId}.{ext} 로 강제 변경되며, PDF 일 때 인덱스도 자동 갱신.
import { NextRequest, NextResponse } from "next/server";
import { uploadToRelease, refreshReleaseIndex } from "@/app/lib/githubRelease";
import { parseWineFieldsFromPptx } from "@/app/lib/tastingNotePptxParse";
import { parseTastingNotesFromPdf } from "@/app/lib/tastingNotePdfParse";
import { backfillWineFieldsIfEmpty, backfillTastingNoteIfEmpty } from "@/app/lib/wineDb";
import { syncBottleImage } from "@/app/lib/wineBottleImage";
import { supabase } from "@/app/lib/db";
import { logChange } from "@/app/lib/changeLogDb";
import { logger } from "@/app/lib/logger";

export const maxDuration = 120;

const CONTENT_TYPE: Record<"pdf" | "pptx", string> = {
  pdf: "application/pdf",
  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json(
        { success: false, error: "GITHUB_TOKEN 환경변수가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const wineId = String(form.get("wineId") || "").trim();

    if (!wineId) {
      return NextResponse.json(
        { success: false, error: "wineId 가 필요합니다." },
        { status: 400 },
      );
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "file 이 누락되었습니다." },
        { status: 400 },
      );
    }

    const originalName = (file as File).name || "";
    const ext = originalName.toLowerCase().match(/\.(pdf|pptx)$/)?.[1] as
      | "pdf"
      | "pptx"
      | undefined;
    if (!ext) {
      return NextResponse.json(
        { success: false, error: "PDF 또는 PPTX 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${wineId}.${ext}`;

    logger.info(
      `[upload-single] ${wineId} ← ${originalName} (${buffer.length}b) → ${fileName}`,
    );

    const url = await uploadToRelease(fileName, buffer, CONTENT_TYPE[ext]);

    // PPTX(시스템 템플릿)면 라벨 파싱 → wines 빈 칸 backfill + 병 이미지 동기화
    let backfilled: string[] = [];
    let imageSynced = false;
    if (ext === "pptx") {
      try {
        const fields = await parseWineFieldsFromPptx(buffer);
        backfilled = await backfillWineFieldsIfEmpty(wineId, fields);
        if (backfilled.length) {
          logger.info(`[upload-single] ${wineId} wines backfill: ${backfilled.join(", ")}`);
        }
      } catch (e) {
        logger.warn(`[upload-single] backfill failed: ${e instanceof Error ? e.message : e}`);
      }
      try {
        imageSynced = !!(await syncBottleImage(supabase, wineId, buffer));
      } catch (e) {
        logger.warn(`[upload-single] bottle image sync failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    let notesBackfilled: string[] = [];
    let indexTotal = 0;
    if (ext === "pdf") {
      // PDF 본문(양조/와이너리/빈티지/색·향·맛) 추출 → tasting_notes 빈 칸만 채움
      try {
        const noteFields = await parseTastingNotesFromPdf(buffer);
        notesBackfilled = await backfillTastingNoteIfEmpty(wineId, noteFields);
        if (notesBackfilled.length) {
          logger.info(`[upload-single] ${wineId} PDF notes backfill: ${notesBackfilled.join(", ")}`);
        }
      } catch (e) {
        logger.warn(`[upload-single] PDF note parse failed: ${e instanceof Error ? e.message : e}`);
      }
      try {
        const result = await refreshReleaseIndex();
        indexTotal = result.total;
      } catch (e) {
        logger.warn(
          `[upload-single] index refresh failed: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    try {
      await logChange("github_release", "tasting_note", wineId, {
        format: ext,
        single: true,
        originalName,
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      success: true,
      wineId,
      format: ext,
      fileName,
      url,
      indexTotal,
      backfilled,
      notesBackfilled,
      imageSynced,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[upload-single] ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
