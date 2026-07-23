// 테이스팅 노트의 와이너리 소개로 브랜드자료실 일괄 보강(미등록·소개 빈 브랜드만).
import { NextResponse } from "next/server";
import { syncAllBrandsFromNotes } from "@/app/lib/brandFromNotes";
import { handleApiError } from "@/app/lib/errors";

export const maxDuration = 60;

export async function POST() {
  try {
    const synced = await syncAllBrandsFromNotes();
    return NextResponse.json({ success: true, synced, count: synced.length });
  } catch (e) {
    return handleApiError(e);
  }
}
