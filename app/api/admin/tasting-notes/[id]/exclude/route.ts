// 테이스팅노트 목록 제외 토글
import { NextRequest, NextResponse } from "next/server";
import { setNoteExcluded } from "@/app/lib/wineNoteExclude";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { excluded } = await request.json();
    await setNoteExcluded(id, !!excluded);
    await logChange(excluded ? 'note_excluded' : 'note_restored', 'wine', id, {});
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
