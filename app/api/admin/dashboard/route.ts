// app/api/admin/dashboard/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { getInventoryValueHistory, recordInventoryValuePartial } from "@/app/lib/inventoryValueDb";
import { getUploadedFilePath } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import * as XLSX from "xlsx";
import * as fs from "fs";

/** 업로드된 엑셀 파일에서 재고금액 직접 계산 */
function calcFromUploadedFiles(): { cdv: number; dl: number } {
  let cdv = 0;
  let dl = 0;

  // CDV: downloads.xlsx → (보세용마[X=23] + KCTC통관후[Y=24] + 보세KCTC[Z=25]) * 공급가[R=17]
  // (2026 창고 개명: 용마→KCTC. 보세용마 X는 아직 못 옮긴 잔여 재고)
  const cdvPath = getUploadedFilePath('downloads');
  if (cdvPath && fs.existsSync(cdvPath)) {
    const wb = XLSX.read(fs.readFileSync(cdvPath), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      for (let i = 1; i < rows.length; i++) {
        const r = (rows[i] || []) as unknown[];
        const supply = Number(r[17]) || 0;
        const bondedYongma = Number(r[23]) || 0;
        const kctc = Number(r[24]) || 0;
        const bondedKctc = Number(r[25]) || 0;
        cdv += (bondedYongma + kctc + bondedKctc) * supply;
      }
    }
  }

  // DL: dl.xlsx → (KCTC[X=23] + 보세(KCTC)[Y=24] + GIG[Z=25] + 안성창고(DL)[AB=27]) * 공급가[R=17]
  const dlPath = getUploadedFilePath('dl');
  if (dlPath && fs.existsSync(dlPath)) {
    const wb = XLSX.read(fs.readFileSync(dlPath), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      for (let i = 1; i < rows.length; i++) {
        const r = (rows[i] || []) as unknown[];
        const supply = Number(r[17]) || 0;
        const kctc = Number(r[23]) || 0;
        const bondedKctc = Number(r[24]) || 0;
        const gig = Number(r[25]) || 0;
        const anseong = Number(r[27]) || 0;
        dl += (kctc + bondedKctc + gig + anseong) * supply;
      }
    }
  }

  return { cdv, dl };
}

export async function GET() {
  try {
    // 이력 + RPC 집계 병렬 호출
    const [history, cdvSummaryRes, dlSummaryRes] = await Promise.all([
      getInventoryValueHistory(90),
      supabase.rpc("fn_inventory_summary_cdv"),
      supabase.rpc("fn_inventory_summary_dl"),
    ]);

    if (cdvSummaryRes.error) throw new Error(cdvSummaryRes.error.message);
    if (dlSummaryRes.error) throw new Error(dlSummaryRes.error.message);

    const cdvSummary = cdvSummaryRes.data;
    const dlSummary = dlSummaryRes.data;

    // 헤드라인 = DB live 합계(RPC total) → 국가/브랜드 분포 합과 항상 일치.
    let cdvInventoryValue = Number(cdvSummary?.total) || 0;
    let dlInventoryValue = Number(dlSummary?.total) || 0;
    let cdvChange = null;
    let dlChange = null;

    // DB가 비어 합계가 0이면 업로드 엑셀에서 보조 계산
    if (cdvInventoryValue === 0 && dlInventoryValue === 0) {
      const cur = calcFromUploadedFiles();
      cdvInventoryValue = cur.cdv;
      dlInventoryValue = cur.dl;
    }

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // 변동 = 현재 live 값 vs '오늘 이전' 마지막 스냅샷
    const prev = [...history].reverse().find((h) => h.recorded_date < today);
    if (prev) {
      if (prev.cdv_value > 0) {
        const d = cdvInventoryValue - prev.cdv_value;
        cdvChange = { amount: d, rate: (d / prev.cdv_value) * 100, previousDate: prev.recorded_date };
      }
      if (prev.dl_value > 0) {
        const d = dlInventoryValue - prev.dl_value;
        dlChange = { amount: d, rate: (d / prev.dl_value) * 100, previousDate: prev.recorded_date };
      }
    }
    // 오늘자 스냅샷 항상 기록(추이 멈춤 방지) — recordInventoryValuePartial은 오늘 날짜로 upsert.
    if (cdvInventoryValue > 0) await recordInventoryValuePartial('cdv', cdvInventoryValue);
    if (dlInventoryValue > 0) await recordInventoryValuePartial('dl', dlInventoryValue);
    // 응답 history에도 오늘 반영(차트 즉시 표시)
    const todayRow = history.find((h) => h.recorded_date === today);
    if (todayRow) {
      if (cdvInventoryValue > 0) todayRow.cdv_value = cdvInventoryValue;
      if (dlInventoryValue > 0) todayRow.dl_value = dlInventoryValue;
    } else if (cdvInventoryValue > 0 || dlInventoryValue > 0) {
      history.push({ recorded_date: today, cdv_value: cdvInventoryValue, dl_value: dlInventoryValue });
    }

    return NextResponse.json({
      success: true,
      data: {
        cdvInventoryValue,
        dlInventoryValue,
        cdvChange,
        dlChange,
        inventoryHistory: history,
        inventoryByCountryCdv: cdvSummary.byCountry || [],
        inventoryByCountryDl: dlSummary.byCountry || [],
        inventoryByBrandCdv: cdvSummary.byBrand || [],
        inventoryByBrandDl: dlSummary.byBrand || [],
        inventoryByItemCdv: cdvSummary.byItem || [],
        inventoryByItemDl: dlSummary.byItem || [],
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
