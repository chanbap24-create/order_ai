import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table") || "";
  if (!table) return NextResponse.json({ error: "missing table" }, { status: 400 });

  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return NextResponse.json({ table, cols });
}
