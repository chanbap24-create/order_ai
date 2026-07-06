// app/api/admin/wines/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getWineByCode, upsertWine, deleteWine, getTastingNote, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";
import { supabase } from "@/app/lib/db";
import { rehostImageUrl } from "@/app/lib/wineBottleImage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wine = await getWineByCode(id);
    if (!wine) {
      return NextResponse.json({ success: false, error: "와인을 찾을 수 없습니다." }, { status: 404 });
    }

    const tastingNote = await getTastingNote(id);
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
      // 이미지 URL을 주면 저장 시점에 Supabase로 재호스팅(핫링크 소스 대비, 서버가 못 가져오면 원본 유지)
      if (typeof body.wine.image_url === "string" && body.wine.image_url) {
        body.wine.image_url = await rehostImageUrl(supabase, id, body.wine.image_url).catch(() => body.wine.image_url);
      }
      try {
        await upsertWine({ ...body.wine, item_code: id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ success: false, error: `와인 저장 실패: ${msg}`, step: 'upsertWine' }, { status: 500 });
      }
    }

    // 테이스팅 노트 업데이트
    if (body.tastingNote) {
      try {
        await upsertTastingNote(id, body.tastingNote);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ success: false, error: `테이스팅 노트 저장 실패: ${msg}`, step: 'upsertTastingNote' }, { status: 500 });
      }
    }

    try {
      await logChange('wine_updated', 'wine', id, { fields: Object.keys(body.wine || {}) });
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
    await deleteWine(id);
    await logChange('wine_deleted', 'wine', id, {});
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
