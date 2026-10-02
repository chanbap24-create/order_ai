// 소믈리에 구매·문답 엑셀 내보내기 — 권한자(박경아·조성재·admin)만. ?from=YYYY-MM-DD&to=YYYY-MM-DD (없으면 전체)
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { canEditDiscounts } from '@/app/lib/sommelierDiscount';
import { loadExportData } from '@/app/lib/sommelierExport/data';
import { buildSommelierWorkbook } from '@/app/lib/sommelierExport/workbook';
import { handleApiError } from '@/app/lib/errors';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    if (!canEditDiscounts(session)) return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) {
      return NextResponse.json({ error: '날짜 형식은 YYYY-MM-DD 입니다.' }, { status: 400 });
    }
    const buf = await buildSommelierWorkbook(await loadExportData(from, to));
    const name = `소믈리에_구매문답_${from || '전체'}${to ? `~${to}` : ''}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
