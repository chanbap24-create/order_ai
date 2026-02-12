import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table") || "";
  if (!table)
    return NextResponse.json({ error: "missing table" }, { status: 400 });

  // Supabase: select a single row to infer columns
  const { data, error } = await supabase.from(table).select("*").limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build column info from the keys of the first row (or empty if table is empty)
  const cols =
    data && data.length > 0
      ? Object.keys(data[0]).map((name, idx) => ({
          cid: idx,
          name,
          type: typeof data[0][name],
        }))
      : [];

  return NextResponse.json({ table, cols });
}
