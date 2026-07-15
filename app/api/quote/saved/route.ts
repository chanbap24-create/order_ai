import { NextRequest, NextResponse } from 'next/server';
import {
  saveQuote, listSavedQuotes, getSavedQuote, deleteSavedQuote, deleteSavedQuotesByDate,
} from '@/app/lib/savedQuotes';
import { releaseStepUp, currentQuarterKey } from '@/app/lib/pricing/stepupLock';

// GET ?id=  → 단건(스냅샷 포함) / GET ?manager=&client_code=&search=&date= → 목록
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get('id');
    if (id) {
      const item = await getSavedQuote(Number(id));
      if (!item) return NextResponse.json({ error: '견적을 찾을 수 없습니다.' }, { status: 404 });
      return NextResponse.json({ success: true, item });
    }
    const items = await listSavedQuotes(sp.get('manager') || '', {
      clientCode: sp.get('client_code') || undefined,
      search: sp.get('search') || undefined,
      date: sp.get('date') || undefined,
    });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error('Saved quotes GET error:', e);
    return NextResponse.json({ error: '저장 견적 조회 실패' }, { status: 500 });
  }
}

// POST → 현재 견적 스냅샷 저장
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await saveQuote({
      manager: body.manager || '',
      client_code: body.client_code || null,
      client_name: body.client_name || '',
      company: body.company || null,
      items: body.items || [],
      doc_settings: body.doc_settings,
      columns: body.columns,
    });
    return NextResponse.json({ success: true, id: result.id });
  } catch (e) {
    console.error('Saved quotes POST error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '저장 실패' }, { status: 400 });
  }
}

// DELETE ?id= — 단건 삭제 / DELETE ?date=YYYY-MM-DD&manager= — 그 날짜(KST) 발행 견적 일괄 삭제
// 이번 분기 견적을 삭제하면 그 거래처의 '하위거래처 보정 분기 1회' 락도 해제
//   (테스트로 보정 견적을 발행해 락이 소모된 경우, 견적 폐기로 되살릴 수 있게)
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const date = req.nextUrl.searchParams.get('date');
    if (!id && date) {
      const r = await deleteSavedQuotesByDate(req.nextUrl.searchParams.get('manager') || '', date);
      return NextResponse.json({ success: true, deleted: r.deleted, stepup_released: r.stepupReleased });
    }
    if (!id) return NextResponse.json({ error: 'id 또는 date가 필요합니다.' }, { status: 400 });
    const sq = await getSavedQuote(Number(id));
    await deleteSavedQuote(Number(id));

    let stepupReleased = false;
    const clientCode = (sq as { client_code?: string } | null)?.client_code;
    const createdAt = (sq as { created_at?: string } | null)?.created_at;
    if (clientCode && createdAt && currentQuarterKey(new Date(createdAt)) === currentQuarterKey()) {
      stepupReleased = await releaseStepUp(clientCode);
    }
    return NextResponse.json({ success: true, stepup_released: stepupReleased });
  } catch (e) {
    console.error('Saved quotes DELETE error:', e);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
