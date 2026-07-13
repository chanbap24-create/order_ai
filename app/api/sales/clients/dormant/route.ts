import { NextRequest, NextResponse } from 'next/server';
import { resolveManagerScope } from '@/app/lib/authz';
import { getDormantClients } from '@/app/lib/dormantClients';

// GET /api/sales/clients/dormant?manager=XXX — 휴면·이탈위험 거래처(본인 발주주기 기준)
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveManagerScope(req.nextUrl.searchParams.get('manager'));
    if (!scope.ok) return scope.res;
    const manager = scope.manager || scope.session.manager;
    if (!manager) return NextResponse.json({ error: 'manager 필요' }, { status: 400 });
    return NextResponse.json(await getDormantClients(manager));
  } catch (e) {
    console.error('GET /api/sales/clients/dormant error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
