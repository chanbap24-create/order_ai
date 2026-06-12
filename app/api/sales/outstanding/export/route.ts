import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { fetchLedgerData, groupData, generateExcel, generatePDF } from '@/app/api/sales/ledger/export/route';
import { getSession } from '@/app/lib/auth';
import { canViewAllManagers, canAccessClient, type ClientType } from '@/app/lib/authz';

// POST /api/sales/outstanding/export
// body: { client_codes: string[], start_date: string, end_date: string, type: string, format: 'excel' | 'pdf' }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const { client_codes, start_date, end_date, type = 'wine', format = 'excel' } = body;

    if (!client_codes || !Array.isArray(client_codes) || client_codes.length === 0) {
      return NextResponse.json({ error: 'client_codes array required' }, { status: 400 });
    }
    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    // 일반 user 는 본인 담당 거래처만 export 가능 (타 매니저 원장 export 방지)
    if (!canViewAllManagers(session)) {
      const checks = await Promise.all(
        client_codes.map((code: string) => canAccessClient(session, code, type as ClientType)),
      );
      const denied = client_codes.filter((_: string, i: number) => !checks[i]);
      if (denied.length > 0) {
        return NextResponse.json(
          { error: `본인 담당이 아닌 거래처가 포함되어 있습니다: ${denied.slice(0, 5).join(', ')}${denied.length > 5 ? ` 외 ${denied.length - 5}건` : ''}` },
          { status: 403 },
        );
      }
    }

    const isPdf = format === 'pdf';
    const ext = isPdf ? 'pdf' : 'xlsx';
    const zip = new JSZip();
    const prefix = type === 'glass' ? '대유라이프' : '까브드뱅';

    // CPU/메모리 보호를 위해 5개씩 병렬 처리 (기존: 1개씩 순차)
    const CONCURRENCY = 5;
    for (let i = 0; i < client_codes.length; i += CONCURRENCY) {
      const batch = client_codes.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (code: string) => {
          try {
            const { client, rows, payments, prevBalance } = await fetchLedgerData(
              code, start_date, end_date, type,
            );
            const grouped = groupData(rows, payments);
            const buf = isPdf
              ? await generatePDF(client, grouped, prevBalance, start_date, end_date)
              : await generateExcel(client, grouped, prevBalance, start_date, end_date);
            const safeName = (client.client_name || code).replace(/[\\/:*?"<>|]/g, '_');
            return {
              name: `${prefix}_매출처원장_${safeName}_${start_date.slice(0, 7)}.${ext}`,
              buf,
            };
          } catch (e) {
            console.error(`Export error for ${code}:`, e);
            return null;
          }
        }),
      );
      for (const r of results) {
        if (r) zip.file(r.name, r.buf);
      }
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const zipName = `${prefix}_매출처원장_일괄_${start_date.slice(0, 7)}.zip`;

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
