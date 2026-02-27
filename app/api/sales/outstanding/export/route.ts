import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { fetchLedgerData, groupData, generateExcel, generatePDF } from '@/app/api/sales/ledger/export/route';

// POST /api/sales/outstanding/export
// body: { client_codes: string[], start_date: string, end_date: string, type: string, format: 'excel' | 'pdf' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_codes, start_date, end_date, type = 'wine', format = 'excel' } = body;

    if (!client_codes || !Array.isArray(client_codes) || client_codes.length === 0) {
      return NextResponse.json({ error: 'client_codes array required' }, { status: 400 });
    }
    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    const isPdf = format === 'pdf';
    const ext = isPdf ? 'pdf' : 'xlsx';
    const zip = new JSZip();

    for (const code of client_codes) {
      try {
        const { client, rows, payments, prevBalance } = await fetchLedgerData(code, start_date, end_date, type);
        const grouped = groupData(rows, payments);
        const buf = isPdf
          ? await generatePDF(client, grouped, prevBalance, start_date, end_date)
          : await generateExcel(client, grouped, prevBalance, start_date, end_date);

        const safeName = (client.client_name || code).replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`매출처원장_${safeName}_${start_date.slice(0, 7)}.${ext}`, buf);
      } catch (e) {
        console.error(`Export error for ${code}:`, e);
      }
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const zipName = `매출처원장_일괄_${start_date.slice(0, 7)}.zip`;

    return new NextResponse(zipBuf, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      },
    });
  } catch (err) {
    console.error('POST /api/sales/outstanding/export error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
