import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export const runtime = 'nodejs';

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  discount_price: number;
  wholesale_price: number;
  retail_price: number;
  min_price: number;
  available_stock: number;
  bonded_warehouse: number;
  incoming_stock: number;
  sales_30days: number;
  vintage: string;
  alcohol_content: string;
  country: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ 
        results: [],
        count: 0,
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
        discount_price,
        wholesale_price,
        retail_price,
        min_price,
        available_stock,
        bonded_warehouse,
        incoming_stock,
        sales_30days,
        vintage,
        alcohol_content,
        country
      FROM inventory_cdv
      WHERE LOWER(item_name) LIKE ? OR LOWER(item_no) LIKE ?
      ORDER BY supply_price DESC
    `).all(searchQuery, searchQuery) as InventoryItem[];

    return NextResponse.json({
      results,
      count: results.length,
      query: query
    });

  } catch (error) {
    console.error('Inventory search error:', error);
    return NextResponse.json(
      { error: '재고 검색 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
