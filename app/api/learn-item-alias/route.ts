import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

/**
 * ✅ 규칙 학습용 alias 정규화
 * - 너무 공격적이면 안 됨 (search_key랑 다름!)
 * - resolveItems.ts의 exact/contains 기준과 동일해야 함
 */
function normalizeAlias(raw: string) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/[()\-_/.,]/g, " ")
    .trim();
}

function ensureItemAliasTable() {
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
    const body = await req.json().catch(() => ({}));

    const rawAlias = String(body?.alias ?? "").trim();
    const canonical = String(body?.canonical ?? "").trim();

    if (!rawAlias || !canonical) {
      return NextResponse.json(
        { success: false, error: "alias/canonical required" },
        { status: 400 }
      );
    }

    // ✅ 규칙 학습용 alias 정규화
    const alias = normalizeAlias(rawAlias);

    if (!alias) {
      return NextResponse.json(
        { success: false, error: "alias empty after normalize" },
        { status: 400 }
      );
    }

    ensureItemAliasTable();

    // ✅ 규칙 학습은 단순 & 강하게 upsert
    db.prepare(`
      INSERT INTO item_alias (alias, canonical, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(alias) DO UPDATE SET
        canonical = excluded.canonical,
        created_at = CURRENT_TIMESTAMP
    `).run(alias, canonical);

    // ✅ 프론트 안정용: 실제 저장된 값 반환
    const row = db.prepare(
      `SELECT alias, canonical, created_at FROM item_alias WHERE alias = ?`
    ).get(alias);

    return NextResponse.json({
      success: true,
      saved: 1,
      row,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
