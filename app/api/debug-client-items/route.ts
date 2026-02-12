import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";

function stripDotZero(x: any) {
  const s = String(x ?? "").trim();
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export async function POST(req: Request) {
  const { clientCode } = await req.json();
  const code = stripDotZero(clientCode);

  // COUNT
  const { count, error: countError } = await supabase
    .from("client_item_stats")
    .select("*", { count: "exact", head: true })
    .eq("client_code", code);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  // TOP 20
  const { data: top, error: topError } = await supabase
    .from("client_item_stats")
    .select("item_no, item_name, buy_count, last_ship_date, avg_price")
    .eq("client_code", code)
    .order("last_ship_date", { ascending: false })
    .order("buy_count", { ascending: false })
    .limit(20);

  if (topError) {
    return NextResponse.json({ error: topError.message }, { status: 500 });
  }

  return NextResponse.json({ clientCode: code, count: count ?? 0, top });
}
