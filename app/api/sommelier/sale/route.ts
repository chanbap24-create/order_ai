// 소믈리에 판매 기록 — 정산 '판매 완료' 1회(결제 단위). 매장 직원 세션 필요.
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { recordSale, type SaleItemInput } from '@/app/lib/sommelierSales';
import { handleApiError } from '@/app/lib/errors';
import { storeViewOf } from '@/app/lib/store/scope';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const view = storeViewOf(session);
  if (!view || view === 'all') return NextResponse.json({ error: '판매는 매장 계정에서만 할 수 있습니다.' }, { status: 403 });
  try {
    const b = await req.json();
    const items: SaleItemInput[] = (Array.isArray(b?.items) ? b.items : []).map((i: Record<string, unknown>) => ({
      item_no: String(i?.item_no || '').trim(),
      item_name: String(i?.item_name || ''),
      qty: Math.max(0, Math.floor(Number(i?.qty) || 0)),
      retail_price: Math.max(0, Number(i?.retail_price) || 0),
      sale_price: Math.max(0, Number(i?.sale_price) || 0),
      source: i?.source === 'quiz' ? 'quiz' : 'stock',
      rec_rank: Number(i?.rec_rank) || null,
    }));
    const res = await recordSale({
      saleId: String(b?.saleId || ''), customerId: Number(b?.customerId) || 0,
      storeKey: view, sessionId: Number(b?.sessionId) || null,
      extraRate: Math.max(0, Number(b?.extraRate) || 0), extraWon: Math.max(0, Number(b?.extraWon) || 0),
      items, manager: session.manager,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ success: true, lines: res.lines });
  } catch (e) {
    return handleApiError(e);
  }
}
