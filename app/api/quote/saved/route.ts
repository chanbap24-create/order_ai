import { NextRequest, NextResponse } from 'next/server';
import {
  saveQuote, listSavedQuotes, getSavedQuote, deleteSavedQuote,
} from '@/app/lib/savedQuotes';

// GET ?id=  → 단건(스냅샷 포함) / GET ?manager=&client_code=&search= → 목록
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

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    await deleteSavedQuote(Number(id));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Saved quotes DELETE error:', e);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
