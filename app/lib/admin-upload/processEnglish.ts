import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { normCode, normText, toNumber } from "./utils";

export async function processEnglish(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 헤더 행 찾기: 국가(country) 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = (rows[i] || []) as unknown[];
    if (r.some((c) => String(c).includes("country") || String(c).includes("국가"))) {
      headerIdx = i;
      break;
    }
  }
  // 데이터 시작: 헤더 + 서브헤더(영문/한글) 건너뛰기
  const dataStart = headerIdx >= 0 ? headerIdx + 2 : 4;

  // Data columns (0-based):
  // 0=seq, 1=item_no, 2=?, 3=country, 4=supplier, 5=region, 6=image,
  // 7=wine_name_en, 8=wine_name_kr, 9=vintage, 10=ml, 11=supply_price,
  // 12=supplier_name, 13=stock, 14=bonded

  await supabase.from('wine_list_english').delete().not('item_no', 'is', null);

  const englishRows: Array<{
    item_no: string; country: string; supplier: string; region: string;
    wine_name_en: string; wine_name_kr: string; vintage: string;
    ml: number | null; supply_price: number | null; supplier_name: string;
    stock: number | null; bonded: number | null; updated_at: string;
  }> = [];

  let count = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const item_no = normCode(r[1]);
    if (!item_no) continue;

    englishRows.push({
      item_no,
      country: normText(r[3]),
      supplier: normText(r[4]),
      region: normText(r[5]),
      wine_name_en: normText(r[7]),
      wine_name_kr: normText(r[8]),
      vintage: normText(r[9]),
      ml: toNumber(r[10]),
      supply_price: toNumber(r[11]),
      supplier_name: normText(r[12]),
      stock: toNumber(r[13]),
      bonded: toNumber(r[14]),
      updated_at: new Date().toISOString(),
    });
    count++;
  }

  for (let i = 0; i < englishRows.length; i += 500) {
    await supabase.from('wine_list_english').insert(englishRows.slice(i, i + 500));
  }

  return { items: count };
}
