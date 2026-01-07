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
      count INTEGER DEFAULT 1,
      last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 기존 테이블에 count 컬럼 추가 (마이그레이션)
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

    // ✅ 규칙 학습 with 누적 카운트
    // - 같은 alias에 같은 canonical을 선택하면 count++
    // - 다른 canonical을 선택하면 count=1로 초기화 (새로운 학습)
    const existing = db.prepare(
      `SELECT canonical, count FROM item_alias WHERE alias = ?`
    ).get(alias) as { canonical: string; count: number } | undefined;

    if (existing && existing.canonical === canonical) {
      // 같은 매핑: count 증가
      db.prepare(`
        UPDATE item_alias
        SET count = count + 1, last_used_at = CURRENT_TIMESTAMP
        WHERE alias = ?
      `).run(alias);
    } else {
      // 새로운 매핑 또는 다른 매핑: 덮어쓰기
      db.prepare(`
        INSERT INTO item_alias (alias, canonical, count, last_used_at, created_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(alias) DO UPDATE SET
          canonical = excluded.canonical,
          count = 1,
          last_used_at = CURRENT_TIMESTAMP
      `).run(alias, canonical);
    }

    // ✅ 프론트 안정용: 실제 저장된 값 반환
    const row = db.prepare(
      `SELECT alias, canonical, count, last_used_at, created_at FROM item_alias WHERE alias = ?`
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
