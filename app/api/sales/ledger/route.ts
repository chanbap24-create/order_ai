import { NextRequest, NextResponse } from 'next/server';
import { isValidClientCode, isValidDate } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { buildLedger } from '@/app/lib/ledger';

// GET: 매출처원장 조회 — 검증·인가만 담당, 조회·계산은 app/lib/ledger.ts
// ?client_code=XXX&start_date=2026-01-01&end_date=2026-02-28&type=wine
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('client_code');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const clientType = searchParams.get('type') || 'wine';

    if (!clientCode || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'client_code, start_date, end_date are required' },
        { status: 400 }
      );
    }

    // 입력값 whitelist 검증
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!isValidClientCode(clientCode)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }
    if (clientType !== 'wine' && clientType !== 'glass') {
      return NextResponse.json({ error: 'Invalid type (wine|glass)' }, { status: 400 });
    }

    // IDOR 방어: 본인 거래처만 접근 (wine/glass 코드 충돌 회피를 위해 type 전달)
    const accessCheck = await requireClientAccess(clientCode, clientType as 'wine' | 'glass');
    if (accessCheck) return accessCheck;

    const result = await buildLedger({
      clientCode,
      clientType: clientType as 'wine' | 'glass',
      startDate,
      endDate,
      fallbackName: searchParams.get('client_name') || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/sales/ledger error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
