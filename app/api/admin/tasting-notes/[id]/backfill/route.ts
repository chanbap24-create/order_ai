// 이미 릴리스에 업로드된 노트로 wines 빈 칸을 즉시 backfill (행별 버튼용).
// PPTX 우선, 없으면 수동 업로드 PDF에서도 양조·와이너리·빈티지 등 본문 추출.
import { NextRequest, NextResponse } from "next/server";
import { parseWineFieldsFromPptx, parseTastingNotesFromPptx } from "@/app/lib/tastingNotePptxParse";
import { parseTastingNotesFromPdf } from "@/app/lib/tastingNotePdfParse";
import { backfillWineFieldsIfEmpty, backfillTastingNoteIfEmpty } from "@/app/lib/wineDb";
import { syncBottleImage } from "@/app/lib/wineBottleImage";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";
import { ensureRegionsClassified } from "@/app/api/admin/wine-regions/lib/classify";

export const maxDuration = 60;

const RELEASE_BASE =
  "https://github.com/chanbap24-create/order_ai/releases/download/note";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const itemCode = (id || "").trim();
    if (!itemCode) {
      return NextResponse.json({ success: false, error: "품번이 필요합니다." }, { status: 400 });
    }

    const pptxRes = await fetch(`${RELEASE_BASE}/${itemCode}.pptx?t=${Date.now()}`, { cache: "no-store" });
    const pdfRes = pptxRes.ok ? null : await fetch(`${RELEASE_BASE}/${itemCode}.pdf?t=${Date.now()}`, { cache: "no-store" });
    if (!pptxRes.ok && !(pdfRes && pdfRes.ok)) {
      return NextResponse.json(
        { success: false, error: "업로드된 노트(PPTX/PDF)가 없습니다." },
        { status: 404 },
      );
    }

    let backfilled: string[] = [];
    let notesBackfilled: string[] = [];
    let imageSynced = false;

    if (pptxRes.ok) {
      const buffer = Buffer.from(await pptxRes.arrayBuffer());
      // wines 기본 메타(지역/품종/빈티지/이름)
      const fields = await parseWineFieldsFromPptx(buffer);
      backfilled = await backfillWineFieldsIfEmpty(itemCode, fields);
      // tasting_notes 본문(양조/와이너리/색·향·맛/빈티지노트/페어링) — 빈 칸만 채움
      const noteFields = await parseTastingNotesFromPptx(buffer);
      notesBackfilled = await backfillTastingNoteIfEmpty(itemCode, noteFields);
      imageSynced = !!(await syncBottleImage(supabase, itemCode, buffer));
    } else if (pdfRes) {
      // PDF: 본문(양조/와이너리/빈티지/색·향·맛/수상) 추출 → tasting_notes 빈 칸만 채움
      const buffer = Buffer.from(await pdfRes.arrayBuffer());
      const noteFields = await parseTastingNotesFromPdf(buffer);
      notesBackfilled = await backfillTastingNoteIfEmpty(itemCode, noteFields);
    }

    // 동기화된 산지를 와인산지DB에 자동 반영(미분류면 LLM 분류 후 행 추가)
    let regionClassified: string | undefined;
    try {
      const { data: w } = await supabase
        .from('wines').select('region, item_name_kr, item_name_en, country_en, country').eq('item_code', itemCode).single();
      if (w) {
        const rc = await ensureRegionsClassified([
          { region: w.region, name: `${w.item_name_kr || ''} ${w.item_name_en || ''}`, country: w.country_en || w.country || '' },
        ]);
        if (rc.addedRows > 0) regionClassified = rc.detail[0];
      }
    } catch (e) {
      logger.error(`[backfill] region auto-classify failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return NextResponse.json({ success: true, backfilled, notesBackfilled, imageSynced, ...(regionClassified ? { regionClassified } : {}) });
  } catch (e) {
    return handleApiError(e);
  }
}
