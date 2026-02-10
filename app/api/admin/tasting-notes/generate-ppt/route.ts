// app/api/admin/tasting-notes/generate-ppt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateTastingNotePpt } from "@/app/lib/pptGenerator";
import { logChange } from "@/app/lib/changeLogDb";
import { upsertTastingNote } from "@/app/lib/wineDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { wineIds } = await request.json();

    if (!Array.isArray(wineIds) || wineIds.length === 0) {
      return NextResponse.json({ success: false, error: "wineIds 배열이 필요합니다." }, { status: 400 });
    }

    const pptBuffer = await generateTastingNotePpt(wineIds);

    // ppt_generated 플래그 업데이트
    for (const wineId of wineIds) {
      upsertTastingNote(wineId, { ppt_generated: 1 });
    }

    logChange('ppt_generated', 'tasting_note', wineIds.join(','), { count: wineIds.length });

    return new NextResponse(new Uint8Array(pptBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="tasting-notes-${Date.now()}.pptx"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
