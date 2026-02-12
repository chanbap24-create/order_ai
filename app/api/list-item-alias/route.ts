import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from "@/app/lib/db";

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from("item_alias")
      .select("alias, canonical, client_code, count, last_used_at, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return jsonResponse({ success: true, rows: rows || [] });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
