import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';
import ExcelJS from 'exceljs';

import { ALL_EXCEL_COLUMNS, DEFAULT_DOC, type DocSettings } from './lib/types';
import { loadTastingNoteIndex } from './lib/assets';
import { buildQuote } from './lib/buildQuote';

export async function GET(request: NextRequest) {
  try {
    ensureQuoteTable();
    ensureWineProfileTable();

    const clientName = request.nextUrl.searchParams.get('client_name') || '';
    const manager = request.nextUrl.searchParams.get('manager') || '';

    let quoteQuery = supabase
      .from('quote_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (manager) quoteQuery = quoteQuery.eq('manager', manager);
    const { data: quoteRows, error: quoteErr } = await quoteQuery;
    if (quoteErr) throw quoteErr;

    const quoteItems = (quoteRows || []) as Array<Record<string, unknown>>;
    const itemCodes = quoteItems
      .map((q) => String(q.item_code || ''))
      .filter(Boolean);

    // Parallel enrichment: grape_varieties (wines) + barcode (inventory_cdv then inventory_dl fallback)
    const grapeMap: Record<string, string> = {};
    const barcodeMap: Record<string, string> = {};

    if (itemCodes.length > 0) {
      const [grapeRes, invCdvRes] = await Promise.all([
        supabase.from('wines').select('item_code, grape_varieties').in('item_code', itemCodes),
        supabase.from('inventory_cdv').select('item_no, barcode').in('item_no', itemCodes),
      ]);

      for (const w of (grapeRes.data || []) as Array<{ item_code: string; grape_varieties: string | null }>) {
        if (w.grape_varieties) grapeMap[w.item_code] = w.grape_varieties;
      }
      for (const inv of (invCdvRes.data || []) as Array<{ item_no: string; barcode: string | null }>) {
        if (inv.barcode) barcodeMap[inv.item_no] = inv.barcode;
      }

      const missingCodes = itemCodes.filter((c) => !barcodeMap[c]);
      if (missingCodes.length > 0) {
        const { data: dlRows } = await supabase
          .from('inventory_dl')
          .select('item_no, barcode')
          .in('item_no', missingCodes);
        for (const inv of (dlRows || []) as Array<{ item_no: string; barcode: string | null }>) {
          if (inv.barcode) barcodeMap[inv.item_no] = inv.barcode;
        }
      }
    }

    const items = quoteItems.map((q) => ({
      ...q,
      grape_varieties: grapeMap[String(q.item_code)] || null,
      barcode: barcodeMap[String(q.item_code)] || null,
    }));

    // Visible columns
    const columnsParam = request.nextUrl.searchParams.get('columns');
    let visibleColumns: string[] = [];
    if (columnsParam) {
      try { visibleColumns = JSON.parse(columnsParam); } catch {}
    }

    // Doc settings
    const settingsParam = request.nextUrl.searchParams.get('doc_settings');
    let docSettings: DocSettings = { ...DEFAULT_DOC };
    if (settingsParam) {
      try { docSettings = { ...docSettings, ...JSON.parse(settingsParam) }; } catch {}
    }

    const company = request.nextUrl.searchParams.get('company') || 'CDV';

    // columns 파라미터가 없으면 전체 열 표시 (기본 세트)
    const activeCols = visibleColumns.length > 0
      ? ALL_EXCEL_COLUMNS.filter(c => c.uiKey === null || visibleColumns.includes(c.uiKey))
      : ALL_EXCEL_COLUMNS.filter(c => c.uiKey === null || !['retail_normal_total', 'retail_discount_total'].includes(c.uiKey || ''));

    const tastingNoteSet = await loadTastingNoteIndex();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    await buildQuote(workbook, items, clientName, activeCols, docSettings, company, tastingNoteSet);

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `견적서_${dateStr}_${clientName || '미지정'}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Quote export error:', error);
    return NextResponse.json(
      { error: '엑셀 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
