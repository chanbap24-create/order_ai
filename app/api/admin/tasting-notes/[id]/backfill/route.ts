// 이미 릴리스에 업로드된 PPTX 노트로 wines 빈 칸을 즉시 backfill (행별 버튼용).
import { NextRequest, NextResponse } from "next/server";
import { parseWineFieldsFromPptx, parseTastingNotesFromPptx } from "@/app/lib/tastingNotePptxParse";
import { backfillWineFieldsIfEmpty, backfillTastingNoteIfEmpty } from "@/app/lib/wineDb";
import { syncBottleImage } from "@/app/lib/wineBottleImage";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

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

    const res = await fetch(`${RELEASE_BASE}/${itemCode}.pptx?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "업로드된 PPTX 노트가 없습니다." },
        { status: 404 },
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    // wines 기본 메타(지역/품종/빈티지/이름)
    const fields = await parseWineFieldsFromPptx(buffer);
    const backfilled = await backfillWineFieldsIfEmpty(itemCode, fields);
    // tasting_notes 본문(양조/와이너리/색·향·맛/빈티지노트/페어링) — 빈 칸만 채움
    const noteFields = await parseTastingNotesFromPptx(buffer);
    const notesBackfilled = await backfillTastingNoteIfEmpty(itemCode, noteFields);
    const imageSynced = !!(await syncBottleImage(supabase, itemCode, buffer));

    return NextResponse.json({ success: true, backfilled, notesBackfilled, imageSynced });
  } catch (e) {
    return handleApiError(e);
  }
}
