import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import { fetchBarcodes } from './lib/enrichment';
import { addQuoteItem } from './lib/addItem';
import { reorderQuoteItems, updateQuoteItem } from './lib/updateItem';

export async function GET(req: NextRequest) {
  try {
    ensureQuoteTable();
    const mgr = req.nextUrl.searchParams.get('manager') || '';

    let query = supabase
      .from('quote_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (mgr) query = query.eq('manager', mgr);

    const { data: items, error } = await query;
    if (error) throw error;

    const codes = (items || [])
      .map((i: { item_code: string | null }) => i.item_code || '')
      .filter(Boolean);
    const barcodeMap = await fetchBarcodes(codes);

    const enriched = (items || []).map((i: { item_code: string }) => ({
      ...i,
      barcode: barcodeMap[i.item_code] || null,
    }));

    return NextResponse.json({ success: true, items: enriched });
  } catch (error) {
    console.error('Quote GET error:', error);
    return NextResponse.json(
      { error: '견적서 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    ensureQuoteTable();
    const body = await req.json();
    const result = await addQuoteItem(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Quote POST error:', error);
    return NextResponse.json(
      { error: '견적서 추가 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    ensureQuoteTable();
    const body = await req.json();

    if (body.action === 'reorder' && Array.isArray(body.items)) {
      return NextResponse.json(await reorderQuoteItems(body.items));
    }

    const { id, ...fields } = body;
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const { status, body: resp } = await updateQuoteItem(id, fields);
    return NextResponse.json(resp, { status });
  } catch (error) {
    console.error('Quote PATCH error:', error);
    return NextResponse.json(
      { error: '견적서 수정 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureQuoteTable();

    let id: string | null = req.nextUrl.searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json();
        id = body.id?.toString() || null;
      } catch {
        // no body
      }
    }
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Quote DELETE error:', error);
    return NextResponse.json(
      { error: '견적서 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
