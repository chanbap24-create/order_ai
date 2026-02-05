import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export const runtime = 'nodejs';

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  available_stock: number;
  anseong_warehouse: number;
  sales_30days: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({
        results: [],
        count: 0,
        query: '',
        message: '검색어를 입력해주세요.'
      });
    }

    // DB에서 검색 (매우 빠름!)
    const searchQuery = `%${query.toLowerCase()}%`;
    
    const results = db.prepare(`
      SELECT 
        item_no,
        item_name,
        supply_price,
        available_stock,
        anseong_warehouse,
        sales_30days
      FROM inventory_dl
      WHERE LOWER(item_name) LIKE ?
      ORDER BY supply_price DESC
    `).all(searchQuery) as InventoryItem[];

    return NextResponse.json({
      results,
      count: results.length,
      query
    });

  } catch (error: any) {
    console.error('DL 재고 검색 오류:', error);
    return NextResponse.json(
      { error: error.message || '검색 중 오류가 발생했습니다.', details: error.stack },
      { status: 500 }
    );
  }
}
