import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { generateSingleWinePpt, generateTastingNotePpt } from '@/app/lib/pptGenerator';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const manager = request.nextUrl.searchParams.get('manager') || '';

    // 견적서 품목 조회 (sort_order 순)
    let query = supabase
      .from('quote_items')
      .select('item_code, product_name, sort_order')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (manager) query = query.eq('manager', manager);

    const { data: quoteRows, error } = await query;
    if (error) throw error;
    if (!quoteRows || quoteRows.length === 0) {
      return NextResponse.json({ error: '견적서에 품목이 없습니다.' }, { status: 400 });
    }

    const itemCodes = quoteRows
      .map((r: any) => r.item_code)
      .filter(Boolean);

    if (itemCodes.length === 0) {
      return NextResponse.json({ error: '품목 코드가 없습니다.' }, { status: 400 });
    }

    // PPTX 생성 (견적서 순서대로)
    let pptBuffer: Buffer;
    if (itemCodes.length === 1) {
      pptBuffer = await generateSingleWinePpt(itemCodes[0]);
    } else {
      pptBuffer = await generateTastingNotePpt(itemCodes);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const clientName = request.nextUrl.searchParams.get('client_name') || '미지정';
    const filename = `테이스팅노트_${dateStr}_${clientName}.pptx`;

    return new NextResponse(pptBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Tasting notes PPTX error:', error);
    return NextResponse.json(
      { error: '테이스팅 노트 PPTX 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
