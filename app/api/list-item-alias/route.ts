import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

function ensure() {
  // ✅ 새 스키마 확인: (alias, client_code) 복합 PRIMARY KEY
  const tableInfo = db.prepare(`
    SELECT COUNT(*) as cnt 
    FROM pragma_table_info('item_alias') 
    WHERE name='client_code' AND pk > 0
  `).get() as { cnt: number };

  // client_code가 PRIMARY KEY의 일부면 이미 마이그레이션됨
  if (tableInfo.cnt > 0) {
    // 새 스키마 사용 중
    return;
  }

  // 기존 테이블이 있으면 마이그레이션 필요
  const hasOldTable = db.prepare(`
    SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='item_alias'
  `).get() as { cnt: number };

  if (hasOldTable.cnt > 0) {
    console.log('[list-item-alias] 🔄 스키마 마이그레이션 필요...');
    // learn-item-alias API가 마이그레이션을 처리하므로 여기서는 스킵
    return;
  }

  // 새 테이블 생성
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_alias (
      alias TEXT NOT NULL,
      canonical TEXT NOT NULL,
      client_code TEXT NOT NULL DEFAULT '*',
      count INTEGER DEFAULT 1,
      last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (alias, client_code)
    )
  `).run();
  
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_item_alias_canonical ON item_alias(canonical, client_code)`).run();
}

export async function GET() {
  try {
    ensure();
    
    // ✅ 모든 컬럼 조회 (client_code 포함)
    const rows = db
      .prepare(`SELECT alias, canonical, client_code, count, last_used_at, created_at FROM item_alias ORDER BY created_at DESC`)
      .all();

    return jsonResponse({ success: true, rows });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
