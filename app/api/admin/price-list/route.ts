// app/api/admin/price-list/route.ts
import { NextResponse } from "next/server";
import { getWinesForPriceList, ensureWineTables } from "@/app/lib/wineDb";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

interface PriceHistoryEntry {
  id: number;
  item_code: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
}

export async function GET() {
  try {
    const wines = await getWinesForPriceList();

    ensureWineTables();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: priceChanges, error } = await supabase
      .from('price_history')
      .select('*')
      .gte('detected_at', thirtyDaysAgo)
      .order('detected_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { wines, priceChanges: priceChanges || [] },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
