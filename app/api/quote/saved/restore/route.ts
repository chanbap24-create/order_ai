import { NextResponse } from 'next/server';
import { restoreSavedQuote } from '@/app/lib/savedQuotes';

// POST { id, manager } → 저장 견적을 현재 작업 초안(quote_items)으로 복원
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    const result = await restoreSavedQuote(Number(body.id), body.manager || '');
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('Saved quote restore error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '복원 실패' }, { status: 400 });
  }
}
