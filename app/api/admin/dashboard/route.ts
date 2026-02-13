// app/api/admin/dashboard/route.ts
import { NextResponse } from "next/server";
import { getWineStats } from "@/app/lib/wineDb";
import { getRecentChanges } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

function calcInventoryValues(): { cdv: number; dl: number } {
  const xlsxPath = path.join(process.cwd(), "order-ai.xlsx");
  if (!fs.existsSync(xlsxPath)) return { cdv: 0, dl: 0 };

  const buffer = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buffer, { type: "buffer" });

  // CDV: (보세[21] + 용마로지스[22]) * 공급가[15]
  let cdv = 0;
  const cdvSheet = wb.SheetNames.find((n) => n.toLowerCase() === "downloads");
  if (cdvSheet) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[cdvSheet], { header: 1 }) as any[][];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const supply = Number(r[15]) || 0;
      const bonded = Number(r[21]) || 0;
      const yongma = Number(r[22]) || 0;
      cdv += (bonded + yongma) * supply;
    }
  }

  // DL: (안성창고[23] + GIG[24] + GIG마케팅[25] + GIG영업1[26]) * 공급가[15]
  let dl = 0;
  const dlSheet = wb.SheetNames.find((n) => n.toLowerCase() === "dl");
  if (dlSheet) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[dlSheet], { header: 1 }) as any[][];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const supply = Number(r[15]) || 0;
      const x = Number(r[23]) || 0;
      const y = Number(r[24]) || 0;
      const z = Number(r[25]) || 0;
      const aa = Number(r[26]) || 0;
      dl += (x + y + z + aa) * supply;
    }
  }

  return { cdv, dl };
}

export async function GET() {
  try {
    const stats = await getWineStats();
    const recentChanges = await getRecentChanges(10);
    const inventoryValues = calcInventoryValues();

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        recentChanges,
        cdvInventoryValue: inventoryValues.cdv,
        dlInventoryValue: inventoryValues.dl,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
