// app/api/admin/tasting-notes/[id]/route.ts - 테이스팅 노트 CRUD
import { NextRequest, NextResponse } from "next/server";
import { getTastingNote, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = getTastingNote(id);
    if (!note) {
      return NextResponse.json({ success: false, error: "테이스팅 노트가 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: note });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    upsertTastingNote(id, {
      ...body,
      manually_edited: 1,
    });

    logChange('tasting_note_edited', 'tasting_note', id, { fields: Object.keys(body) });

    const updated = getTastingNote(id);
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
