import type ExcelJS from 'exceljs';
import type { ColDef, DocSettings } from './types';
import { buildHeader } from './buildHeader';
import { buildDataRows } from './buildDataRows';
import { buildSummary } from './buildSummary';
import type { BottleImageMap } from './imagePreload';

export async function buildQuote(
  wb: ExcelJS.Workbook,
  items: Record<string, unknown>[],
  clientName: string,
  activeCols: ColDef[],
  doc: DocSettings,
  company: string,
  tastingNoteSet: Set<string>,
  bottleImages: BottleImageMap,
): Promise<void> {
  const ws = wb.addWorksheet('견적서');
  ws.columns = activeCols.map(c => ({ width: c.width }));

  // uiKey → 1-based col index
  const pos: Record<string, number> = {};
  activeCols.forEach((c, i) => { if (c.uiKey) pos[c.uiKey] = i + 1; });

  buildHeader(wb, ws, activeCols, clientName, doc, company);

  const { DS } = await buildDataRows(wb, ws, items, activeCols, pos, tastingNoteSet, bottleImages);

  buildSummary(ws, activeCols, pos, items, DS, doc);

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}
