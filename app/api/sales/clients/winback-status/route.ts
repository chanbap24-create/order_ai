import { NextRequest, NextResponse } from 'next/server';
import { resolveManagerScope } from '@/app/lib/authz';
import { getWinbackStatusMap } from '@/app/lib/dormantClients';

// POST /api/sales/clients/winback-status { codes: string[] }
// → { statuses: { [client_code]: 'dormant' | 'risk' } } — 거래처 목록 윈백 배지용
export async function POST(req: NextRequest) {
  try {
    const scope = await resolveManagerScope(null);
    if (!scope.ok) return scope.res;

    const { codes } = await req.json();
    if (!Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ statuses: {} });
    }
    const clean = codes.filter((c): c is string => typeof c === 'string' && c.length > 0).slice(0, 3000);
    return NextResponse.json({ statuses: await getWinbackStatusMap(clean) });
  } catch (e) {
    console.error('POST /api/sales/clients/winback-status error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
