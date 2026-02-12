import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from "@/app/lib/db";
import * as XLSX from "xlsx";

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

    // 1) 엑셀 로드
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets["English"];
    if (!ws) {
      return jsonResponse(
        { success: false, error: `Sheet "English" not found` },
        { status: 400 }
      );
    }

    // 2) 범위 파악
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

    // 3) 데이터 수집
    let scanned = 0;
    let saved = 0;

    const rows: Array<{ item_no: string; name_en: string; updated_at: string }> = [];

    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      // B열(=2), H열(=8)
      const bAddr = XLSX.utils.encode_cell({ r, c: 1 });
      const hAddr = XLSX.utils.encode_cell({ r, c: 7 });

      const itemNo = normCell(ws[bAddr]?.v);
      const nameEn = normCell(ws[hAddr]?.v);

      // 빈 행 skip
      if (!itemNo || !nameEn) continue;

      scanned++;
      rows.push({
        item_no: itemNo,
        name_en: nameEn,
        updated_at: new Date().toISOString(),
      });
    }

    // 4) Batch upsert
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase
        .from('item_english')
        .upsert(batch, { onConflict: 'item_no' });
      if (!error) {
        saved += batch.length;
      }
    }

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
