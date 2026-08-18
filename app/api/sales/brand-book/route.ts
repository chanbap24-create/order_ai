// 브랜드북 PDF 발행 — 세일즈 와인리스트 옵션(가격대별 최소재고)과 동일 규칙 + 실질 재고 하한.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { buildBrandBookData } from '@/app/lib/brand-book/data';
import { renderBrandBookPdf } from '@/app/lib/brand-book/render';
import { handleApiError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';

export const maxDuration = 300; // 이미지 다수 임베드 — 생성에 수 분 소요 가능

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    let minStock: Record<string, number> | null = null;
    const raw = req.nextUrl.searchParams.get('minStock');
    if (raw) {
      try { minStock = JSON.parse(raw); } catch { /* 무시 → 기본 규칙 */ }
    }
    const t0 = Date.now();
    const brands = await buildBrandBookData({ minStock });
    const pdf = await renderBrandBookPdf(brands);
    logger.info(`[BrandBook] ${brands.length} brands, ${brands.reduce((s, b) => s + b.wines.length, 0)} wines, ${(pdf.length / 1024 / 1024).toFixed(1)}MB in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="brandbook_${today}.pdf"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
