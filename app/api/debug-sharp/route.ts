// 임시 진단 라우트 — 프로덕션에서 sharp/exceljs 로드·동작 확인용. 확인 후 삭제.
import { NextResponse } from 'next/server';

export async function GET() {
  const out: Record<string, unknown> = {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };
  try {
    const sharp = (await import('sharp')).default;
    out.sharp_version = sharp.versions;
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    out.sharp_op = `ok ${png.length}B`;
  } catch (e) {
    out.sharp_error = e instanceof Error ? `${e.message}\n${e.stack?.slice(0, 800)}` : String(e);
  }
  try {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('t').getCell('A1').value = 1;
    const buf = await wb.xlsx.writeBuffer();
    out.exceljs_op = `ok ${(buf as ArrayBuffer).byteLength}B`;
  } catch (e) {
    out.exceljs_error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(out);
}
