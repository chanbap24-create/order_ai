import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";

export async function GET() {
  // Supabase: query information_schema to list all tables in the public schema
  const { data, error } = await supabase.rpc("get_table_list").select("*");

  if (error) {
    // Fallback: try querying information_schema directly
    const { data: tables, error: fallbackError } = await supabase
      .from("information_schema.tables" as any)
      .select("table_name")
      .eq("table_schema", "public")
      .order("table_name");

    if (fallbackError) {
      // Last resort: return the error
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    return NextResponse.json({
      tables: (tables || []).map((t: any) => ({ name: t.table_name })),
    });
  }

  return NextResponse.json({
    tables: (data || []).map((t: any) => ({ name: t.table_name || t.name })),
  });
}
