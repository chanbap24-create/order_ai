import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory
 *
 * Query parameters:
 * - search: 검색어 (품목번호 또는 품목명)
 * - stock_filter: 재고 필터 (all, in_stock, out_of_stock, bonded_only)
 * - page: 페이지 번호 (default: 1)
 * - limit: 페이지당 항목 수 (default: 50)
 * - sort: 정렬 기준 (item_no, item_name, available_stock, bonded_warehouse)
 * - order: 정렬 순서 (asc, desc)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const search = searchParams.get('search') || '';
    const stockFilter = searchParams.get('stock_filter') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200); // Max 200
    const sort = searchParams.get('sort') || 'item_no';
    const order = searchParams.get('order') || 'asc';

    // Validate sort column
    const validSortColumns = ['item_no', 'item_name', 'available_stock', 'bonded_warehouse'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'item_no';
    const ascending = order !== 'desc';

    // Build Supabase query for count
    let countQuery = supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });

    // Build Supabase query for data
    let dataQuery = supabase
      .from('inventory')
      .select('item_no, item_name, available_stock, bonded_warehouse, updated_at');

    // Build Supabase query for stats
    let statsQuery = supabase
      .from('inventory')
      .select('available_stock, bonded_warehouse');

    // Apply search filter
    if (search) {
      const searchPattern = `%${search}%`;
      const searchFilter = `item_no.ilike.${searchPattern},item_name.ilike.${searchPattern}`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
      statsQuery = statsQuery.or(searchFilter);
    }

    // Apply stock filter
    switch (stockFilter) {
      case 'in_stock':
        countQuery = countQuery.or('available_stock.gt.0,bonded_warehouse.gt.0');
        dataQuery = dataQuery.or('available_stock.gt.0,bonded_warehouse.gt.0');
        statsQuery = statsQuery.or('available_stock.gt.0,bonded_warehouse.gt.0');
        break;
      case 'out_of_stock':
        countQuery = countQuery.eq('available_stock', 0).eq('bonded_warehouse', 0);
        dataQuery = dataQuery.eq('available_stock', 0).eq('bonded_warehouse', 0);
        statsQuery = statsQuery.eq('available_stock', 0).eq('bonded_warehouse', 0);
        break;
      case 'bonded_only':
        countQuery = countQuery.gt('bonded_warehouse', 0);
        dataQuery = dataQuery.gt('bonded_warehouse', 0);
        statsQuery = statsQuery.gt('bonded_warehouse', 0);
        break;
      // 'all' - no filter
    }

    // Pagination
    const offset = (page - 1) * limit;
    dataQuery = dataQuery
      .order(sortColumn, { ascending })
      .range(offset, offset + limit - 1);

    // Execute queries in parallel
    const [countResult, dataResult, statsResult] = await Promise.all([
      countQuery,
      dataQuery,
      statsQuery,
    ]);

    if (countResult.error) throw countResult.error;
    if (dataResult.error) throw dataResult.error;
    if (statsResult.error) throw statsResult.error;

    const totalItems = countResult.count || 0;
    const totalPages = Math.ceil(totalItems / limit);
    const items = dataResult.data || [];

    // Calculate stats from statsResult data
    const statsData = statsResult.data || [];
    const totalAvailableStock = statsData.reduce((sum: number, r: any) => sum + (r.available_stock || 0), 0);
    const totalBondedWarehouse = statsData.reduce((sum: number, r: any) => sum + (r.bonded_warehouse || 0), 0);
    const itemsWithStock = statsData.filter((r: any) => (r.available_stock || 0) > 0 || (r.bonded_warehouse || 0) > 0).length;
    const itemsOutOfStock = statsData.filter((r: any) => (r.available_stock || 0) === 0 && (r.bonded_warehouse || 0) === 0).length;

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        stats: {
          total_items: statsData.length,
          total_available_stock: totalAvailableStock,
          total_bonded_warehouse: totalBondedWarehouse,
          items_with_stock: itemsWithStock,
          items_out_of_stock: itemsOutOfStock,
        },
        filters: {
          search,
          stock_filter: stockFilter,
          sort: sortColumn,
          order: ascending ? 'ASC' : 'DESC',
        },
      },
    });

  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
