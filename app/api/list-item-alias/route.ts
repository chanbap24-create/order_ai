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
  
  // ✅ count, last_used_at 컬럼 추가 (마이그레이션)
  try {
    db.prepare(`ALTER TABLE item_alias ADD COLUMN count INTEGER DEFAULT 1`).run();
  } catch {
    // 컬럼이 이미 존재하면 무시
  }

  try {
    db.prepare(`ALTER TABLE item_alias ADD COLUMN last_used_at TEXT DEFAULT CURRENT_TIMESTAMP`).run();
  } catch {
    // 컬럼이 이미 존재하면 무시
  }
}

export async function GET() {
  try {
    ensure();
    
    // ✅ 모든 컬럼 조회 (count, last_used_at 포함)
    const rows = db
      .prepare(`SELECT alias, canonical, count, last_used_at, created_at FROM item_alias ORDER BY created_at DESC`)
      .all();

    return jsonResponse({ success: true, rows });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
