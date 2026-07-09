// app/api/admin/tasting-notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTastingNotes, upsertTastingNote } from "@/app/lib/wineDb";
import { supabase } from "@/app/lib/db";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const country = url.searchParams.get('country') || undefined;
    const hasNoteParam = url.searchParams.get('hasNote');
    const hasNote = hasNoteParam === 'true' ? true : hasNoteParam === 'false' ? false : undefined;

    const wines = await getTastingNotes({ search, country, hasNote });

    // 재고 정보 병합 — ≤500 코드씩 배치(단발 .in은 1000행 캡에 걸려 초과 품목 재고가 0으로 표기됨)
    const codes = wines.map(w => w.item_code);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invMap = new Map<string, any>();
    for (let i = 0; i < codes.length; i += 500) {
      const { data: inv } = await supabase
        .from('inventory_cdv')
        .select('item_no, available_stock, bonded_warehouse')
        .in('item_no', codes.slice(i, i + 500));
      for (const x of (inv || [])) invMap.set(x.item_no, x);
    }

    const enriched = wines.map(w => {
      const stock = invMap.get(w.item_code);
      return { ...w, inv_available: stock?.available_stock ?? 0, inv_bonded: stock?.bonded_warehouse ?? 0 };
    });

    return NextResponse.json({ success: true, data: enriched });
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

    await upsertTastingNote(wineId, noteData);
    await logChange('tasting_note_saved', 'tasting_note', wineId, {});

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
