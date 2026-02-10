// app/api/admin/price-list/route.ts
import { NextResponse } from "next/server";
import { getWinesForPriceList, ensureWineTables } from "@/app/lib/wineDb";
import { db } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";
import type { PriceHistoryEntry } from "@/app/types/wine";

export const runtime = "nodejs";

export async function GET() {
  try {
    const wines = getWinesForPriceList();

    ensureWineTables();
    const priceChanges = db.prepare(`
      SELECT * FROM price_history
      WHERE detected_at > datetime('now', '-30 days')
      ORDER BY detected_at DESC
    `).all() as PriceHistoryEntry[];

    return NextResponse.json({
      success: true,
      data: { wines, priceChanges },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
