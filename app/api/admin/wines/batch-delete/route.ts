// POST /api/admin/wines/batch-delete - 일괄 삭제
import { NextRequest, NextResponse } from "next/server";
import { deleteWines } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { wineIds } = await request.json();

    if (!Array.isArray(wineIds) || wineIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "wineIds 배열이 필요합니다." },
        { status: 400 },
      );
    }

    const deleted = await deleteWines(wineIds);

    await logChange(
      "batch_delete",
      "wine",
      wineIds.join(","),
      { count: wineIds.length, deleted },
    );

    return NextResponse.json({ success: true, deleted, total: wineIds.length });
  } catch (e) {
    return handleApiError(e);
  }
}
