import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function ensureItemEnglishTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_english (
      item_no TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function normCell(v: any) {
  return String(v ?? "").trim();
}

export async function POST() {
  try {
    const filePath = process.env.ORDER_AI_XLSX_PATH;
    if (!filePath) {
      return jsonResponse(
        { success: false, error: "ORDER_AI_XLSX_PATH is not set" },
        { status: 400 }
      );
    }

    // 1) 테이블 보장
    ensureItemEnglishTable();

    // 2) 엑셀 로드
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets["English"];
    if (!ws) {
      return jsonResponse(
        { success: false, error: `Sheet "English" not found` },
        { status: 400 }
      );
    }

    // 3) 범위 파악
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

    // 4) 업서트 준비
    const upsert = db.prepare(`
      INSERT INTO item_english(item_no, name_en, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_no) DO UPDATE SET
        name_en = excluded.name_en,
        updated_at = CURRENT_TIMESTAMP
    `);

    let scanned = 0;
    let saved = 0;

    const tx = db.transaction(() => {
      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        // B열(=2), H열(=8)
        const bAddr = XLSX.utils.encode_cell({ r, c: 1 });
        const hAddr = XLSX.utils.encode_cell({ r, c: 7 });

        const itemNo = normCell(ws[bAddr]?.v);
        const nameEn = normCell(ws[hAddr]?.v);

        // 빈 행 skip
        if (!itemNo || !nameEn) continue;

        scanned++;
        const info = upsert.run(itemNo, nameEn);
        // INSERT든 UPDATE든 changes는 1로 떨어짐이 일반적
        if (info.changes) saved += 1;
      }
    });

    tx();

    return jsonResponse({
      success: true,
      filePath,
      scanned,
      saved,
    });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
