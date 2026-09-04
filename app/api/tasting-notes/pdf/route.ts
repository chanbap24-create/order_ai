// 단일 품목 테이스팅 노트 PDF 다운로드 (브리핑 통관 섹션 등)
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { isValidItemNo } from '@/app/lib/validators';
import { fetchTastingNotePdf } from '@/app/lib/tastingNotePdf';
import { handleApiError } from '@/app/lib/errors';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const itemCode = req.nextUrl.searchParams.get('item_code') || '';
    if (!itemCode || !isValidItemNo(itemCode)) {
      return NextResponse.json({ error: 'item_code가 올바르지 않습니다.' }, { status: 400 });
    }
    const note = await fetchTastingNotePdf(itemCode);
    if (!note) {
      return NextResponse.json({ error: '이 품목의 테이스팅 노트가 없습니다.' }, { status: 404 });
    }
    return new NextResponse(note.bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`테이스팅노트_${note.code}.pdf`)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
