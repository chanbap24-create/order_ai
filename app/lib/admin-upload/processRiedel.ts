import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { normText, toNumber } from "./utils";

export async function processRiedel(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 헤더 행 찾기: "Code" 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = (rows[i] || []) as unknown[];
    if (r.some((c) => String(c).trim() === "Code")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("리델 헤더 행을 찾을 수 없습니다. 'Code' 컬럼이 필요합니다.");

  // 기존 riedel_items 삭제
  await supabase.from('riedel_items').delete().not('code', 'is', null);

  let count = 0;
  let lastSeries = "";

  const riedelRows: Array<{
    code: string; series: string; item_kr: string; item_en: string;
    unit: number | null; supply_price: number | null; box_price: number | null; note: string;
    updated_at: string;
  }> = [];

  const glassUpdates: Array<{ code: string; supply_price: number }> = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const code = normText(r[1]);
    if (!code) continue;

    const series = normText(r[0]) || lastSeries;
    if (normText(r[0])) lastSeries = normText(r[0]);

    const supplyPrice = toNumber(r[5]);

    riedelRows.push({
      code, series, item_kr: normText(r[2]), item_en: normText(r[3]),
      unit: toNumber(r[4]), supply_price: supplyPrice, box_price: toNumber(r[6]),
      note: normText(r[7]), updated_at: new Date().toISOString(),
    });

    // glass_items에 공급가 반영
    if (supplyPrice != null) {
      glassUpdates.push({ code, supply_price: supplyPrice });
    }

    count++;
  }

  for (let i = 0; i < riedelRows.length; i += 500) {
    await supabase.from('riedel_items').insert(riedelRows.slice(i, i + 500));
  }

  for (const u of glassUpdates) {
    await supabase.from('glass_items')
      .update({ supply_price: u.supply_price, updated_at: new Date().toISOString() })
      .eq('item_no', u.code);
  }

  return { items: count };
}
