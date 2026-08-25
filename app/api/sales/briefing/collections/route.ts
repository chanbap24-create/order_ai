import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { buildCollectionBriefing } from '@/app/lib/collection-alerts';

// 오늘의 수금 브리핑: 매니저 거래처 중 연체(예정일 경과)/오늘 수금약속/약속어김 추출.
// 로직은 app/lib/collection-alerts.ts (텔레그램/알림톡 발송과 단일 소스 공유).
const isAdmin = (r: string) => r === 'admin' || r === 'executive' || r === 'sales_admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;

    const briefing = await buildCollectionBriefing(manager);
    return NextResponse.json(briefing);
  } catch (err) {
    console.error('GET /api/sales/briefing/collections error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
