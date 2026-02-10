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
  let id = '';
  try {
    id = (await params).id;
    const body = await request.json();

    // 와인 정보 업데이트
    if (body.wine) {
      try {
        upsertWine({ ...body.wine, item_code: id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ success: false, error: `와인 저장 실패: ${msg}`, step: 'upsertWine' }, { status: 500 });
      }
    }

    // 테이스팅 노트 업데이트
    if (body.tastingNote) {
      try {
        upsertTastingNote(id, body.tastingNote);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ success: false, error: `테이스팅 노트 저장 실패: ${msg}`, step: 'upsertTastingNote' }, { status: 500 });
      }
    }

    try {
      logChange('wine_updated', 'wine', id, { fields: Object.keys(body.wine || {}) });
    } catch { /* logChange 실패 무시 */ }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: `PATCH 오류 [${id}]: ${msg}` }, { status: 500 });
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
