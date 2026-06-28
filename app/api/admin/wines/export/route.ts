// GET /api/admin/wines/export - 와인리스트 엑셀 다운로드 (어드민). 로직은 lib/wineListExcel 공용.
import { NextRequest, NextResponse } from "next/server";
import { generateWineListExcel } from "@/app/lib/wineListExcel";

function parseMinStock(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const pick: Record<string, number> = {};
    for (const k of ["u20k", "u50k", "u100k", "u200k", "over"]) {
      const v = Math.round(Number(o[k]));
      if (Number.isFinite(v) && v > 0) pick[k] = v;
    }
    return Object.keys(pick).length ? pick : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const buffer = await generateWineListExcel({
      search: url.searchParams.get("search") || "",
      country: url.searchParams.get("country") || "",
      hideZero: url.searchParams.get("hideZero") === "1",
      minStock: parseMinStock(url.searchParams.get("minStock")),
    });
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="wine-list_${today}.xlsx"`,
      },
    });
  } catch (e) {
    console.error('[WineExport]', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
