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

    // 재고 정보 병합
    const codes = wines.map(w => w.item_code);
    const { data: inv } = codes.length > 0
      ? await supabase.from('inventory_cdv').select('item_no, available_stock, bonded_warehouse').in('item_no', codes)
      : { data: [] };
    const invMap = new Map((inv || []).map(i => [i.item_no, i]));

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
