import { NextResponse } from 'next/server';
import { generateFlavorTagsExcel } from '@/app/lib/flavorTagsData';

// 향미태그 목록 엑셀 다운로드 (미들웨어가 admin_auth 강제). 얇게 유지 — 로직은 lib.
export async function GET() {
  try {
    const buffer = await generateFlavorTagsExcel();
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="flavor-tags_${today}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '엑셀 생성 실패' }, { status: 500 });
  }
}
