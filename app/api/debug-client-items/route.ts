import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

function stripDotZero(x: any) {
  const s = String(x ?? "").trim();
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export async function POST(req: Request) {
  const { clientCode } = await req.json();
  const code = stripDotZero(clientCode);

  const cnt = db
    .prepare("SELECT COUNT(*) as c FROM client_item_stats WHERE client_code=?")
    .get(code) as any;

  const top = db.prepare(`
    SELECT item_no, item_name, buy_count, last_ship_date, avg_price
    FROM client_item_stats
    WHERE client_code=?
    ORDER BY last_ship_date DESC, buy_count DESC
    LIMIT 20
  `).all(code);

  return NextResponse.json({ clientCode: code, count: cnt.c, top });
}
