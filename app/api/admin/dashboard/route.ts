// app/api/admin/dashboard/route.ts
import { NextResponse } from "next/server";
import { getInventoryValueHistory, recordInventoryValuePartial } from "@/app/lib/inventoryValueDb";
import { getUploadedFilePath } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import * as XLSX from "xlsx";
import * as fs from "fs";

/** 업로드된 엑셀 파일에서 재고금액 직접 계산 */
function calcFromUploadedFiles(): { cdv: number; dl: number } {
  let cdv = 0;
  let dl = 0;

  // CDV: downloads.xlsx → (보세(용마)[23] + 용마로지스[24]) * 공급가[17]
  const cdvPath = getUploadedFilePath('downloads');
  if (cdvPath && fs.existsSync(cdvPath)) {
    const wb = XLSX.read(fs.readFileSync(cdvPath), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      for (let i = 1; i < rows.length; i++) {
        const r = (rows[i] || []) as unknown[];
        const supply = Number(r[17]) || 0;
        const bonded = Number(r[23]) || 0;
        const yongma = Number(r[24]) || 0;
        cdv += (bonded + yongma) * supply;
      }
    }
  }

  // DL: dl.xlsx → (안성[25] + GIG[26] + GIG마케팅[27] + GIG영업1[28]) * 공급가[17]
  const dlPath = getUploadedFilePath('dl');
  if (dlPath && fs.existsSync(dlPath)) {
    const wb = XLSX.read(fs.readFileSync(dlPath), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      for (let i = 1; i < rows.length; i++) {
        const r = (rows[i] || []) as unknown[];
        const supply = Number(r[17]) || 0;
        const anseong = Number(r[25]) || 0;
        const gig = Number(r[26]) || 0;
        const gigMkt = Number(r[27]) || 0;
        const gigSales = Number(r[28]) || 0;
        dl += (anseong + gig + gigMkt + gigSales) * supply;
      }
    }
  }

  return { cdv, dl };
}

export async function GET() {
  try {
    const history = await getInventoryValueHistory(90);

    let cdvInventoryValue = 0;
    let dlInventoryValue = 0;
    let cdvChange = null;
    let dlChange = null;

    // 이력이 없으면 업로드된 엑셀에서 현재값 계산 후 첫 이력으로 기록
    if (history.length === 0) {
      const current = calcFromUploadedFiles();
      cdvInventoryValue = current.cdv;
      dlInventoryValue = current.dl;

      if (current.cdv > 0 || current.dl > 0) {
        if (current.cdv > 0) await recordInventoryValuePartial('cdv', current.cdv);
        if (current.dl > 0) await recordInventoryValuePartial('dl', current.dl);
        history.push({
          recorded_date: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
          cdv_value: current.cdv,
          dl_value: current.dl,
        });
      }
    } else {
      const latest = history[history.length - 1];
      cdvInventoryValue = latest.cdv_value;
      dlInventoryValue = latest.dl_value;

      if (history.length >= 2) {
        const prev = history[history.length - 2];

        if (prev.cdv_value > 0) {
          const cdvDiff = latest.cdv_value - prev.cdv_value;
          cdvChange = {
            amount: cdvDiff,
            rate: (cdvDiff / prev.cdv_value) * 100,
            previousDate: prev.recorded_date,
          };
        }

        if (prev.dl_value > 0) {
          const dlDiff = latest.dl_value - prev.dl_value;
          dlChange = {
            amount: dlDiff,
            rate: (dlDiff / prev.dl_value) * 100,
            previousDate: prev.recorded_date,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        cdvInventoryValue,
        dlInventoryValue,
        cdvChange,
        dlChange,
        inventoryHistory: history,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
