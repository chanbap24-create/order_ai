import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

function ensure() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_alias (
      alias TEXT PRIMARY KEY,
      canonical TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function GET() {
  try {
    ensure();
    const rows = db
      .prepare(`SELECT alias, canonical, created_at FROM item_alias ORDER BY created_at DESC`)
      .all();

    return jsonResponse({ success: true, rows });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
