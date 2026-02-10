import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // 테이블 존재 확인
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    // wines 테이블 정보
    let wineCount = 0;
    let wineColumns: string[] = [];
    let sampleWine = null;
    try {
      wineCount = (db.prepare("SELECT COUNT(*) as cnt FROM wines").get() as { cnt: number }).cnt;
      wineColumns = (db.prepare("PRAGMA table_info(wines)").all() as { name: string }[]).map(c => c.name);
      sampleWine = db.prepare("SELECT item_code, item_name_kr, status, ai_researched FROM wines LIMIT 1").get();
    } catch (e) {
      sampleWine = { error: e instanceof Error ? e.message : String(e) };
    }

    // tasting_notes 테이블
    let noteCount = 0;
    try {
      noteCount = (db.prepare("SELECT COUNT(*) as cnt FROM tasting_notes").get() as { cnt: number }).cnt;
    } catch { /* */ }

    return NextResponse.json({
      success: true,
      dbPath: process.env.VERCEL ? '/tmp/data.sqlite3' : 'local',
      tables: tables.map(t => t.name),
      wines: { count: wineCount, columns: wineColumns, sample: sampleWine },
      tastingNotes: { count: noteCount },
      env: {
        VERCEL: !!process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
