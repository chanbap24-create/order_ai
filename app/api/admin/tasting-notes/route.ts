// app/api/admin/tasting-notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTastingNotes, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const country = url.searchParams.get('country') || undefined;
    const hasNoteParam = url.searchParams.get('hasNote');
    const hasNote = hasNoteParam === 'true' ? true : hasNoteParam === 'false' ? false : undefined;

    const wines = getTastingNotes({ search, country, hasNote });
    return NextResponse.json({ success: true, data: wines });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wineId, ...noteData } = body;

    if (!wineId) {
      return NextResponse.json({ success: false, error: "wineId가 필요합니다." }, { status: 400 });
    }

    upsertTastingNote(wineId, noteData);
    logChange('tasting_note_saved', 'tasting_note', wineId, {});

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
