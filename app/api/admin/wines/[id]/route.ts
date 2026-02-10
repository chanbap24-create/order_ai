// app/api/admin/wines/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getWineByCode, upsertWine, deleteWine, getTastingNote, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wine = getWineByCode(id);
    if (!wine) {
      return NextResponse.json({ success: false, error: "와인을 찾을 수 없습니다." }, { status: 404 });
    }

    const tastingNote = getTastingNote(id);
    return NextResponse.json({ success: true, data: { wine, tastingNote } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 와인 정보 업데이트
    if (body.wine) {
      upsertWine({ ...body.wine, item_code: id });
    }

    // 테이스팅 노트 업데이트
    if (body.tastingNote) {
      upsertTastingNote(id, body.tastingNote);
      logChange('tasting_note_saved', 'tasting_note', id, {});
    }

    logChange('wine_updated', 'wine', id, { fields: Object.keys(body.wine || {}) });

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    deleteWine(id);
    logChange('wine_deleted', 'wine', id, {});
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
