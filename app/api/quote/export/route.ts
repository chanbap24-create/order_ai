import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { supabase } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';
import ExcelJS from 'exceljs';

import { ALL_EXCEL_COLUMNS, DEFAULT_DOC, type DocSettings } from './lib/types';
import { loadTastingNoteIndex } from './lib/assets';
import { buildQuote } from './lib/buildQuote';
import { preloadBottleImages } from './lib/imagePreload';

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

    // Visible columns — JSON.parse 후 형/길이 가드로 DoS·이상 입력 차단
    const columnsParam = request.nextUrl.searchParams.get('columns');
    let visibleColumns: string[] = [];
    if (columnsParam) {
      try {
        const parsed = JSON.parse(columnsParam);
        if (
          Array.isArray(parsed) &&
          parsed.length <= 50 &&
          parsed.every((x) => typeof x === 'string' && x.length <= 60)
        ) {
          visibleColumns = parsed;
        }
      } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
    }

    // Doc settings
    const settingsParam = request.nextUrl.searchParams.get('doc_settings');
    let docSettings: DocSettings = { ...DEFAULT_DOC };
    if (settingsParam) {
      try { docSettings = { ...docSettings, ...JSON.parse(settingsParam) }; } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
    }

    const company = request.nextUrl.searchParams.get('company') || 'CDV';

    // columns 파라미터가 없으면 전체 열 표시 (기본 세트)
    // 있으면 사용자가 ◀▶로 지정한 visibleColumns 배열 순서대로 출력.
    // No.(uiKey=null) 같이 항상 표시되는 컬럼은 항상 맨 앞 고정.
    let activeCols;
    if (visibleColumns.length > 0) {
      const alwaysShown = ALL_EXCEL_COLUMNS.filter(c => c.uiKey === null);
      const colMap = new Map(ALL_EXCEL_COLUMNS.map(c => [c.uiKey, c]));
      const orderedUserCols = visibleColumns
        .map(k => colMap.get(k))
        .filter((c): c is typeof ALL_EXCEL_COLUMNS[number] => Boolean(c) && c!.uiKey !== null);
      activeCols = [...alwaysShown, ...orderedUserCols];
    } else {
      activeCols = ALL_EXCEL_COLUMNS.filter(c => c.uiKey === null || !['retail_normal_total', 'retail_discount_total'].includes(c.uiKey || ''));
    }

    // 이미지 일괄 prefetch + tasting-note 인덱스를 병렬 로드.
    // items 목록 기준 itemCodes 로 bottle_images 한 번에 조회 후 파일 병렬 읽기.
    const itemCodesForImage = items.map((q) => String(q.item_code || '')).filter(Boolean);
    const itemsForImage = items.map((q) => ({
      item_code: String(q.item_code || ''),
      image_url: typeof q.image_url === 'string' ? q.image_url : null,
    }));
    const [tastingNoteSet, bottleImages] = await Promise.all([
      loadTastingNoteIndex(),
      preloadBottleImages(itemCodesForImage, itemsForImage),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    await buildQuote(
      workbook, items, clientName, activeCols, docSettings, company,
      tastingNoteSet, bottleImages,
    );

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
