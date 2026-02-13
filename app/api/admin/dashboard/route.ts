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

    // ── 브랜드 추출: 와인=영문 2~4자, 글라스=RD 뒤 숫자 4자리 ──
    function extractBrand(itemName: string, type: 'cdv' | 'dl'): string {
      const tokens = (itemName || '').split(/[\s]+/);
      if (type === 'dl') {
        if (tokens.length >= 2 && /^RD$/i.test(tokens[0])) {
          const m = tokens[1].match(/^(\d{3,5})/);
          if (m) return m[1];
        }
        return '';
      }
      const first = tokens[0].toUpperCase();
      if (/^[A-Z]{2,4}$/.test(first)) return first;
      return '';
    }

    // ── 재고 분석: 국가별 / 브랜드별 / 품목별 ──
    const INV_PAGE = 1000;
    type InvItem = { item_no: string; item_name: string; brand: string; country: string; value: number };
    const cdvItems: InvItem[] = [];
    const dlItems: InvItem[] = [];

    // CDV 재고
    let cdvOff = 0;
    let cdvHas = true;
    while (cdvHas) {
      const { data: rows } = await supabase
        .from('inventory_cdv')
        .select('item_no, item_name, country, supply_price, bonded_warehouse, yongma_logistics')
        .range(cdvOff, cdvOff + INV_PAGE - 1);
      if (!rows || rows.length === 0) { cdvHas = false; break; }
      for (const r of rows) {
        const val = ((r.bonded_warehouse || 0) + (r.yongma_logistics || 0)) * (r.supply_price || 0);
        if (val > 0) {
          cdvItems.push({
            item_no: r.item_no, item_name: r.item_name || '',
            brand: extractBrand(r.item_name || '', 'cdv'), country: r.country || '', value: val,
          });
        }
      }
      if (rows.length < INV_PAGE) cdvHas = false;
      else cdvOff += INV_PAGE;
    }

    // DL 재고
    let dlOff = 0;
    let dlHas = true;
    while (dlHas) {
      const { data: rows } = await supabase
        .from('inventory_dl')
        .select('item_no, item_name, country, supply_price, anseong_warehouse, gig_warehouse, gig_marketing, gig_sales1')
        .range(dlOff, dlOff + INV_PAGE - 1);
      if (!rows || rows.length === 0) { dlHas = false; break; }
      for (const r of rows) {
        const val = ((r.anseong_warehouse || 0) + (r.gig_warehouse || 0) + (r.gig_marketing || 0) + (r.gig_sales1 || 0)) * (r.supply_price || 0);
        if (val > 0) {
          dlItems.push({
            item_no: r.item_no, item_name: r.item_name || '',
            brand: extractBrand(r.item_name || '', 'dl'), country: r.country || '', value: val,
          });
        }
      }
      if (rows.length < INV_PAGE) dlHas = false;
      else dlOff += INV_PAGE;
    }

    // 국가별 / 브랜드별 재고가액 — CDV / DL 분리
    function aggregateBy(items: InvItem[], key: 'country' | 'brand', fallback: string) {
      const m = new Map<string, number>();
      for (const it of items) {
        const k = it[key] || fallback;
        m.set(k, (m.get(k) || 0) + it.value);
      }
      return Array.from(m.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
    }
    const inventoryByCountryCdv = aggregateBy(cdvItems, 'country', '(미분류)');
    const inventoryByCountryDl = aggregateBy(dlItems, 'country', '(미분류)');
    const inventoryByBrandCdv = aggregateBy(cdvItems, 'brand', '(기타)');
    const inventoryByBrandDl = aggregateBy(dlItems, 'brand', '(기타)');

    // 품목별 재고가액 — CDV / DL 분리
    const toItem = (it: InvItem) => ({
      itemNo: it.item_no, name: it.item_name,
      brand: it.brand, country: it.country, value: it.value,
    });
    const inventoryByItemCdv = cdvItems
      .sort((a, b) => b.value - a.value).slice(0, 30).map(toItem);
    const inventoryByItemDl = dlItems
      .sort((a, b) => b.value - a.value).slice(0, 30).map(toItem);

    return NextResponse.json({
      success: true,
      data: {
        cdvInventoryValue,
        dlInventoryValue,
        cdvChange,
        dlChange,
        inventoryHistory: history,
        inventoryByCountryCdv,
        inventoryByCountryDl,
        inventoryByBrandCdv,
        inventoryByBrandDl,
        inventoryByItemCdv,
        inventoryByItemDl,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
