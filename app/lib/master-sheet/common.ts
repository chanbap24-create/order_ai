import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const XLSX_PATH = path.join(process.cwd(), 'order-ai.xlsx');

/**
 * order-ai.xlsx에서 특정 시트명(대소문자 무관)을 읽어 2D 배열로 반환.
 * 파일/시트 없으면 null.
 */
export function readSheetRows(sheetNameLower: string): unknown[][] | null {
  if (!fs.existsSync(XLSX_PATH)) {
    console.warn('[masterSheet] order-ai.xlsx not found:', XLSX_PATH);
    return null;
  }

  try {
    const buffer = fs.readFileSync(XLSX_PATH);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === sheetNameLower);
    if (!sheetName) {
      console.warn(`[masterSheet] ${sheetNameLower} sheet not found`);
      return null;
    }
    const sheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  } catch (error) {
    console.error(`[masterSheet] Error loading ${sheetNameLower} sheet:`, error);
    return null;
  }
}

export function parsePrice(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const cleaned = String(raw).replace(/[,\s]/g, '').trim();
  const parsed = Number(cleaned);
  if (!isNaN(parsed) && parsed > 0) return parsed;
  return undefined;
}

export function trimCell(raw: unknown): string {
  return raw != null ? String(raw).trim() : '';
}
