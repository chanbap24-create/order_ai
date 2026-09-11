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

    // 재고 정보 병합 — CDV(inventory_cdv) 우선, 없으면 DL(inventory_dl). ≤500 코드씩 배치.
    const codes = wines.map(w => w.item_code);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invMap = new Map<string, any>();
    for (let i = 0; i < codes.length; i += 500) {
      const batch = codes.slice(i, i + 500);
      const [{ data: cdv }, { data: dl }] = await Promise.all([
        supabase.from('inventory_cdv').select('item_no, available_stock, stock_bonded, incoming_stock').in('item_no', batch),
        supabase.from('inventory_dl').select('item_no, available_stock, total_stock, incoming_stock, store_ssg_gangnam_dl, store_ssg_southcity').in('item_no', batch),
      ]);
      for (const x of (cdv || [])) invMap.set(x.item_no, x);
      // CDV에 없는 DL 와인 — 재고가 매장에만 있을 수 있어 가용·전체·매장합 중 최대로 표시
      for (const x of (dl || [])) {
        if (invMap.has(x.item_no)) continue;
        const store = (Number(x.store_ssg_gangnam_dl) || 0) + (Number(x.store_ssg_southcity) || 0);
        const avail = Math.max(Number(x.available_stock) || 0, Number(x.total_stock) || 0, store);
        invMap.set(x.item_no, { available_stock: avail, stock_bonded: 0, incoming_stock: Number(x.incoming_stock) || 0 });
      }
    }

    const enriched = wines.map(w => {
      const stock = invMap.get(w.item_code);
      return {
        ...w,
        inv_available: stock?.available_stock ?? 0,
        inv_bonded: Number(stock?.stock_bonded ?? 0), // 보세 합계 = 생성 컬럼
        inv_incoming: stock?.incoming_stock ?? 0, // 입고예정 — 신규 와인은 이 단계가 첫 등장
      };
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
