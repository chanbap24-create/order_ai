// app/api/admin/tasting-notes/[id]/approve/route.ts - 테이스팅 노트 승인
import { NextRequest, NextResponse } from "next/server";
import { upsertTastingNote, getTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getTastingNote(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "테이스팅 노트가 없습니다. 먼저 AI 조사를 실행하세요." }, { status: 404 });
    }

    await upsertTastingNote(id, { approved: 1 });

    await logChange('tasting_note_approved', 'tasting_note', id, {});

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
