import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { candidateClients } from '@/app/lib/clientSuggest';

// GET ?text=<발주문>&tab=CDV|DL — 발주 텍스트 기반 거래처 후보(품목 매칭 + 60일 빈도)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const text = (req.nextUrl.searchParams.get('text') || '').slice(0, 2000);
    if (text.trim().length < 10) return NextResponse.json({ clients: [] });
    const tab = req.nextUrl.searchParams.get('tab') === 'DL' ? 'DL' as const : 'CDV' as const;

    const clients = await candidateClients(session.manager, text, { tab });
    return NextResponse.json({ clients });
  } catch (err) {
    console.error('GET /api/order-v2/client-suggest error:', err);
    return NextResponse.json({ clients: [] }); // 추천 실패는 조용히 빈 목록 (발주 흐름 방해 금지)
  }
}
