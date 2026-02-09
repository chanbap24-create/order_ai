import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';

export const runtime = 'nodejs';

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  available_stock: number;
  anseong_warehouse: number;
  sales_30days: number;
  vintage: string;
  alcohol_content: string;
  country: string;
}

export async function GET(request: NextRequest) {
  try {
    ensureWineProfileTable();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const filterCountry = searchParams.get('country') || '';
    const filterRegion = searchParams.get('region') || '';
    const filterWineType = searchParams.get('wine_type') || '';
    const filterGrapeVariety = searchParams.get('grape_variety') || '';

    if (!query.trim() && !filterCountry && !filterRegion && !filterWineType && !filterGrapeVariety) {
      return NextResponse.json({
        results: [],
        count: 0,
        query: '',
        message: '검색어를 입력해주세요.'
      });
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (query.trim()) {
      const searchQuery = `%${query.toLowerCase()}%`;
      conditions.push('LOWER(i.item_name) LIKE ?');
      params.push(searchQuery);
    }

    if (filterCountry) {
      conditions.push('(i.country = ? OR wp.country = ?)');
      params.push(filterCountry, filterCountry);
    }

    if (filterRegion) {
      conditions.push('wp.region = ?');
      params.push(filterRegion);
    }

    if (filterWineType) {
      conditions.push('wp.wine_type = ?');
      params.push(filterWineType);
    }

    if (filterGrapeVariety) {
      conditions.push('wp.grape_varieties LIKE ?');
      params.push(`%${filterGrapeVariety}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const results = db.prepare(`
      SELECT
        i.item_no,
        i.item_name,
        i.supply_price,
        i.available_stock,
        i.anseong_warehouse,
        i.sales_30days,
        i.vintage,
        i.alcohol_content,
        i.country,
        wp.grape_varieties,
        wp.wine_type,
        wp.region AS wp_region,
        wp.description_kr
      FROM inventory_dl i
      LEFT JOIN wine_profiles wp ON i.item_no = wp.item_code
      ${whereClause}
      ORDER BY i.supply_price DESC
    `).all(...params) as InventoryItem[];

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
