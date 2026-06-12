import type ExcelJS from 'exceljs';
import type { ColDef } from './types';
import { IMG_ROW_HEIGHT } from './types';
import { TASTING_NOTE_BASE_URL } from './assets';
import type { BottleImageMap } from './imagePreload';
import {
  THIN, CURR, PCT, HEADER_FILL, ALT_FILL, SUMMARY_FILL, FONT,
  colLetter, sc, sf,
} from './excelStyles';

const CATS: Record<string, string> = {
  '0':'Champagne','1':'Sparkling','2':'Red','3':'White','4':'Rosé','5':'Icewine',
  '6':'Grappa','7':'Set','8':'POS Material','9':'자재','A':'Port','Z':'타사제품',
};


export async function buildDataRows(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  items: Record<string, unknown>[],
  activeCols: ColDef[],
  pos: Record<string, number>,
  tastingNoteSet: Set<string>,
  bottleImages: BottleImageMap,
): Promise<{ DS: number }> {
  // Column headers (Row 21)
  const hBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF2D1A1A' } },
    bottom: { style: 'thin', color: { argb: 'FF2D1A1A' } },
    left: { style: 'thin', color: { argb: 'FF5A3030' } },
    right: { style: 'thin', color: { argb: 'FF5A3030' } },
  };
  const hRow = ws.getRow(21);
  hRow.height = 32;
  activeCols.forEach((col, i) => {
    sc(hRow, i + 1, col.label, { border: hBorder, fill: HEADER_FILL, bold: true, size: 10, wrap: true, color: 'FFFFFFFF' });
  });

  const DS = 22;
  const hasImageCol = activeCols.some(c => c.type === 'image');

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const r = DS + idx;
    const row = ws.getRow(r);
    row.height = hasImageCol ? IMG_ROW_HEIGHT : 45;

    const rowFill = idx % 2 === 1 ? ALT_FILL : undefined;

    for (let ci = 0; ci < activeCols.length; ci++) {
      const col = activeCols[ci];
      const c = ci + 1;

      if (col.type === 'index') {
        sc(row, c, idx + 1, { border: THIN, fill: rowFill, align: 'center' });
        continue;
      }

      if (col.type === 'image') {
        renderImageCell(wb, ws, row, r, c, ci, item, rowFill, bottleImages);
        continue;
      }

      if (col.type === 'formula') {
        renderFormulaCell(row, r, c, col, item, pos, rowFill);
        continue;
      }

      if (col.type === 'link') {
        renderLinkCell(row, c, item, tastingNoteSet, rowFill);
        continue;
      }

      if (col.uiKey === 'category') {
        const cat = CATS[String(item.item_code || '').charAt(0).toUpperCase()] || '-';
        sc(row, c, cat, { border: THIN, align: 'center', fill: rowFill });
        continue;
      }

      renderDataCell(row, c, col, item, rowFill);
    }
  }

  return { DS };
}

/**
 * 이미지 셀 렌더링. DB/파일 I/O 없음 — 미리 preload 된 Map 에서 버퍼 꺼내 Excel 에 쓰기만.
 * route.ts 의 preloadBottleImages 가 사전에 병렬 로드를 끝내둔다.
 */
function renderImageCell(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  r: number,
  c: number,
  ci: number,
  item: Record<string, unknown>,
  rowFill: ExcelJS.Fill | undefined,
  bottleImages: BottleImageMap,
) {
  const cell = row.getCell(c);
  cell.border = THIN;
  if (rowFill) cell.fill = rowFill;

  const itemCode = String(item.item_code || '');
  if (!itemCode) return;

  const pre = bottleImages.get(itemCode);
  if (!pre) return; // preload 실패 or TIFF 제외 케이스

  const imgId = wb.addImage({ buffer: pre.buffer, extension: pre.ext });

  // twoCell(셀 채움) 앵커 — MS Excel(맥/윈도우)은 앵커 from/to 로 이미지를
  // 셀에 정확히 맞춰 항상 정중앙. (oneCell 고정크기는 맥 Excel 이 13자 컬럼을
  // 78pt×120pt 로 계산해 이미지(72×90pt)가 좌상단에 작게 붙음 — 사용 금지.)
  // ExcelJS 가 twoCell 의 그림 xfrm 크기를 0 으로 기록하는 문제는
  // route.ts 의 patchDrawingExt 가 zip 후처리로 보정한다.
  ws.addImage(imgId, {
    tl: { col: ci, row: r - 1 },
    br: { col: ci + 1, row: r },
    editAs: 'twoCell',
  });
}

function renderFormulaCell(
  row: ExcelJS.Row,
  r: number,
  c: number,
  col: ColDef,
  item: Record<string, unknown>,
  pos: Record<string, number>,
  rowFill: ExcelJS.Fill | undefined,
) {
  const n = (k: string) => Number(item[k] || 0);

  // 모바일/카톡 프리뷰어는 수식 계산 엔진이 없어 `{ formula, result }` 형태로 캐시값 필수.
  // 각 수식 옆에 동일한 결과를 계산해서 result로 전달.

  if (col.uiKey === 'discounted_price') {
    if (n('discounted_price') > 0) {
      sc(row, c, n('discounted_price'), { border: THIN, fmt: CURR, color: 'FFFF0000', fill: rowFill });
    } else if (pos['supply_price'] && pos['discount_rate']) {
      const sp = colLetter(pos['supply_price']);
      const dr = colLetter(pos['discount_rate']);
      const result = Math.round(n('supply_price') * (1 - n('discount_rate')));
      sf(row, c, `IFERROR(${sp}${r}*(1-${dr}${r}),"")`, { border: THIN, fmt: CURR, color: 'FFFF0000', fill: rowFill, result });
    } else {
      sc(row, c, Math.round(n('supply_price') * (1 - n('discount_rate'))), { border: THIN, fmt: CURR, color: 'FFFF0000', fill: rowFill });
    }
    return;
  }
  if (col.uiKey === 'retail_discounted_price') {
    if (pos['retail_price'] && pos['discount_rate']) {
      const rp = colLetter(pos['retail_price']);
      const dr = colLetter(pos['discount_rate']);
      const result = Math.round(n('retail_price') * (1 - n('discount_rate')));
      sf(row, c, `IFERROR(${rp}${r}*(1-${dr}${r}),"")`, { border: THIN, fmt: CURR, color: 'FFFF0000', fill: rowFill, result });
    } else {
      sc(row, c, Math.round(n('retail_price') * (1 - n('discount_rate'))), { border: THIN, fmt: CURR, color: 'FFFF0000', fill: rowFill });
    }
    return;
  }
  if (col.uiKey === 'normal_total') {
    if (pos['supply_price'] && pos['quantity']) {
      const sp = colLetter(pos['supply_price']);
      const qty = colLetter(pos['quantity']);
      const result = n('supply_price') * n('quantity');
      sf(row, c, `IFERROR(${sp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: rowFill, result });
    } else {
      sc(row, c, n('supply_price') * n('quantity'), { border: THIN, fmt: CURR, fill: rowFill });
    }
    return;
  }
  if (col.uiKey === 'discount_total') {
    if (pos['supply_price'] && pos['discount_rate'] && pos['quantity']) {
      const sp = colLetter(pos['supply_price']);
      const dr = colLetter(pos['discount_rate']);
      const qty = colLetter(pos['quantity']);
      const result = Math.round(n('supply_price') * (1 - n('discount_rate')) * n('quantity'));
      sf(row, c, `IFERROR(${sp}${r}*(1-${dr}${r})*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: SUMMARY_FILL, result });
    } else if (pos['discounted_price'] && pos['quantity']) {
      const dp = colLetter(pos['discounted_price']);
      const qty = colLetter(pos['quantity']);
      const dpVal = n('discounted_price') > 0 ? n('discounted_price') : Math.round(n('supply_price') * (1 - n('discount_rate')));
      const result = dpVal * n('quantity');
      sf(row, c, `IFERROR(${dp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: SUMMARY_FILL, result });
    } else {
      const dp = Math.round(n('supply_price') * (1 - n('discount_rate')));
      sc(row, c, dp * n('quantity'), { border: THIN, fmt: CURR, fill: SUMMARY_FILL });
    }
    return;
  }
  if (col.uiKey === 'min_price_total') {
    if (pos['min_price'] && pos['quantity']) {
      const mp = colLetter(pos['min_price']);
      const qty = colLetter(pos['quantity']);
      const result = n('min_price') * n('quantity');
      sf(row, c, `IFERROR(${mp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: rowFill, result });
    } else {
      sc(row, c, n('min_price') * n('quantity'), { border: THIN, fmt: CURR, fill: rowFill });
    }
    return;
  }
  if (col.uiKey === 'retail_normal_total') {
    if (pos['retail_price'] && pos['quantity']) {
      const rp = colLetter(pos['retail_price']);
      const qty = colLetter(pos['quantity']);
      const result = n('retail_price') * n('quantity');
      sf(row, c, `IFERROR(${rp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: rowFill, result });
    } else {
      sc(row, c, n('retail_price') * n('quantity'), { border: THIN, fmt: CURR, fill: rowFill });
    }
    return;
  }
  if (col.uiKey === 'retail_discount_total') {
    if (pos['retail_price'] && pos['discount_rate'] && pos['quantity']) {
      const rp = colLetter(pos['retail_price']);
      const dr = colLetter(pos['discount_rate']);
      const qty = colLetter(pos['quantity']);
      const result = Math.round(n('retail_price') * (1 - n('discount_rate')) * n('quantity'));
      sf(row, c, `IFERROR(${rp}${r}*(1-${dr}${r})*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: SUMMARY_FILL, result });
    } else {
      const rdp = Math.round(n('retail_price') * (1 - n('discount_rate')));
      sc(row, c, rdp * n('quantity'), { border: THIN, fmt: CURR, fill: SUMMARY_FILL });
    }
  }
}

function renderLinkCell(
  row: ExcelJS.Row,
  c: number,
  item: Record<string, unknown>,
  tastingNoteSet: Set<string>,
  rowFill: ExcelJS.Fill | undefined,
) {
  const itemCode = String(item.item_code || '');
  if (!itemCode) {
    sc(row, c, '', { border: THIN, fill: rowFill });
    return;
  }
  const exists = tastingNoteSet.has(itemCode);
  const pdfUrl = `${TASTING_NOTE_BASE_URL}/${itemCode}.pdf?v=${Date.now()}`;
  const cell = row.getCell(c);
  if (exists) {
    cell.value = { text: '테이스팅노트', hyperlink: pdfUrl } as ExcelJS.CellHyperlinkValue;
    cell.font = { name: FONT, size: 9, color: { argb: 'FF27AE60' }, underline: true };
  } else {
    cell.value = '테이스팅노트(없음)';
    cell.font = { name: FONT, size: 9, color: { argb: 'FF8B1538' } };
  }
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = THIN;
  if (rowFill) cell.fill = rowFill;
}

function renderDataCell(
  row: ExcelJS.Row,
  c: number,
  col: ColDef,
  item: Record<string, unknown>,
  rowFill: ExcelJS.Fill | undefined,
) {
  const val = col.dataField ? (item[col.dataField] ?? '') : '';

  if (col.type === 'currency') {
    sc(row, c, Number(val) || 0, { border: THIN, fmt: CURR, fill: rowFill });
  } else if (col.type === 'percent') {
    sc(row, c, Number(val) || 0, { border: THIN, fmt: PCT, color: 'FFFF0000', align: 'center', fill: rowFill });
  } else if (col.type === 'number') {
    sc(row, c, Number(val) || 0, { border: THIN, align: 'center', fill: rowFill });
  } else {
    const leftAlign = ['product_name', 'english_name', 'korean_name', 'note', 'tasting_note', 'region', 'grape_varieties'].includes(col.uiKey || '');
    const bold = col.uiKey === 'product_name' || col.uiKey === 'korean_name';
    const isNote = col.uiKey === 'note';
    sc(row, c, String(val), {
      border: THIN,
      align: leftAlign ? 'left' : 'center',
      bold,
      wrap: true,
      color: isNote ? 'FFFF0000' : undefined,
      size: (col.uiKey === 'tasting_note' || col.uiKey === 'note') ? 9 : undefined,
      fill: rowFill,
    });
  }
}
