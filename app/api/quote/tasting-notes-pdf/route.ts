import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { PDFDocument } from 'pdf-lib';

export const maxDuration = 60;

const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const TASTING_NOTE_INDEX_URL = `${TASTING_NOTE_BASE_URL}/tasting-notes-index.json`;

async function loadTastingNoteIndex(): Promise<Set<string>> {
  try {
    const res = await fetch(`${TASTING_NOTE_INDEX_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const s = new Set<string>();
    for (const [k, v] of Object.entries(data.notes || {} as Record<string, any>)) {
      if ((v as any)?.exists) s.add(k);
    }
    return s;
  } catch {
    return new Set();
  }
}

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

    // 테이스팅 노트 존재 여부 확인
    const noteIndex = await loadTastingNoteIndex();
    const itemCodes = quoteRows
      .map((r: any) => r.item_code)
      .filter((code: string) => code && noteIndex.has(code));

    if (itemCodes.length === 0) {
      return NextResponse.json({ error: '테이스팅 노트가 있는 와인이 없습니다.' }, { status: 404 });
    }

    // PDF 병합
    const mergedPdf = await PDFDocument.create();
    const skipped: string[] = [];

    for (const itemCode of itemCodes) {
      try {
        const pdfUrl = `${TASTING_NOTE_BASE_URL}/${itemCode}.pdf?t=${Date.now()}`;
        const res = await fetch(pdfUrl, { cache: 'no-store' });
        if (!res.ok) {
          skipped.push(itemCode);
          continue;
        }
        const pdfBytes = await res.arrayBuffer();
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
      } catch {
        skipped.push(itemCode);
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json({ error: 'PDF를 병합할 수 없습니다.' }, { status: 500 });
    }

    const mergedBytes = await mergedPdf.save();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const clientName = request.nextUrl.searchParams.get('client_name') || '미지정';
    const filename = `테이스팅노트_${dateStr}_${clientName}.pdf`;

    return new NextResponse(mergedBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Tasting notes PDF merge error:', error);
    return NextResponse.json(
      { error: '테이스팅 노트 PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
