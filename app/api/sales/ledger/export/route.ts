import { NextRequest, NextResponse } from 'next/server';
import { isValidClientCode, isValidDate } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { fetchLedgerData } from './lib/fetchLedger';
import { groupData } from './lib/groupData';
import { generateExcel } from './lib/generateExcel';
import { generatePDF } from './lib/generatePDF';

// outstanding/export 등 외부 경로가 import 하므로 re-export 유지
export { fetchLedgerData } from './lib/fetchLedger';
export { groupData } from './lib/groupData';
export type { GroupedDay, GroupedMonth } from './lib/groupData';
export { generateExcel } from './lib/generateExcel';
export { generatePDF } from './lib/generatePDF';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('client_code');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const clientType = searchParams.get('type') || 'wine';
    const format = searchParams.get('format') || 'excel';

    if (!clientCode || !startDate || !endDate) {
      return NextResponse.json({ error: 'client_code, start_date, end_date required' }, { status: 400 });
    }

    // 입력값 whitelist 검증 (PostgREST 필터 인젝션 방지)
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!isValidClientCode(clientCode)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }
    if (clientType !== 'wine' && clientType !== 'glass') {
      return NextResponse.json({ error: 'Invalid type (wine|glass)' }, { status: 400 });
    }

    // IDOR 방어: 로그인한 매니저가 해당 거래처에 접근 권한이 있는지 확인 (wine/glass 코드 충돌 회피)
    const accessCheck = await requireClientAccess(clientCode, clientType as 'wine' | 'glass');
    if (accessCheck) return accessCheck;

    const { client, rows, payments, prevBalance } = await fetchLedgerData(clientCode, startDate, endDate, clientType);
    const grouped = groupData(rows, payments);
    const safeName = (client.client_name || clientCode).replace(/[\\/:*?"<>|]/g, '_');
    const prefix = clientType === 'glass' ? '대유라이프' : '까브드뱅';

    if (format === 'pdf') {
      const buf = await generatePDF(client, grouped, prevBalance, startDate, endDate);
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${prefix}_매출처원장_${safeName}_${startDate.slice(0, 7)}.pdf`)}`,
        },
      });
    }

    const buf = await generateExcel(client, grouped, prevBalance, startDate, endDate);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${prefix}_매출처원장_${safeName}_${startDate.slice(0, 7)}.xlsx`)}`,
      },
    });
  } catch (err) {
    console.error('Ledger export error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
