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

export async function POST(req: Request) {
  try {
    ensure();
    const body = await req.json().catch(() => ({}));
    const alias = String(body?.alias || "").trim();
    if (!alias) return jsonResponse({ success: false, error: "alias required" }, { status: 400 });

    db.prepare(`DELETE FROM item_alias WHERE alias = ?`).run(alias);

    return jsonResponse({ success: true });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
