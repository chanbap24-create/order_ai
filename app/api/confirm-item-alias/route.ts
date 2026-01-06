// app/api/confirm-item-alias/route.ts
import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

function normAlias(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,]/g, " ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const aliasRaw = body?.alias; // 사용자가 입력한 표현(예: "샤블리 프리미에 2")
    const client_code = body?.client_code ? String(body.client_code) : null; // 선택(거래처별 학습)
    const item_no = String(body?.item_no || "");
    const item_name = String(body?.item_name || "");

    const alias = normAlias(aliasRaw);
    if (!alias || !item_no) {
      return NextResponse.json(
        { success: false, error: "alias, item_no는 필수입니다." },
        { status: 400 }
      );
    }

    // ✅ 테이블 없으면 자동 생성
    db.exec(`
      CREATE TABLE IF NOT EXISTS item_alias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alias TEXT NOT NULL,
        item_no TEXT NOT NULL,
        item_name TEXT,
        client_code TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_item_alias_alias ON item_alias(alias);
      CREATE INDEX IF NOT EXISTS idx_item_alias_client ON item_alias(client_code);
    `);

    db.prepare(
      `
      INSERT INTO item_alias(alias, item_no, item_name, client_code)
      VALUES(?, ?, ?, ?)
      `
    ).run(alias, item_no, item_name, client_code);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
