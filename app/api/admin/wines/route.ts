// app/api/admin/wines/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getWines, upsertWine } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const country = url.searchParams.get('country') || undefined;

    const wines = getWines({ status, search, country });
    return NextResponse.json({ success: true, data: wines });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    upsertWine(body);
    logChange('wine_created', 'wine', body.item_code, { item_name: body.item_name_kr });
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
