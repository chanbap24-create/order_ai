import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";

export async function GET() {
  try {
    // 테이블 목록 (Supabase에서는 hardcoded or information_schema)
    const knownTables = [
      'inventory_cdv', 'inventory_dl', 'quote_items',
      'item_alias', 'client_alias', 'token_mapping', 'search_learning',
      'shipments', 'client_item_stats', 'wines', 'tasting_notes',
      'glass_clients', 'glass_client_alias', 'glass_inventory',
      'glass_client_item_stats', 'wine_profiles',
    ];

    // wines 테이블 정보
    let wineCount = 0;
    const wineColumns = ['item_code', 'item_name_kr', 'status', 'ai_researched'];
    let sampleWine: any = null;
    try {
      const { count } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true });
      wineCount = count || 0;

      const { data } = await supabase
        .from('wines')
        .select('item_code, item_name_kr, status, ai_researched')
        .limit(1);
      sampleWine = data?.[0] || null;
    } catch (e) {
      sampleWine = { error: e instanceof Error ? e.message : String(e) };
    }

    // tasting_notes 테이블
    let noteCount = 0;
    try {
      const { count } = await supabase
        .from('tasting_notes')
        .select('*', { count: 'exact', head: true });
      noteCount = count || 0;
    } catch { /* */ }

    return NextResponse.json({
      success: true,
      dbPath: 'supabase',
      tables: knownTables,
      wines: { count: wineCount, columns: wineColumns, sample: sampleWine },
      tastingNotes: { count: noteCount },
      env: {
        VERCEL: !!process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
