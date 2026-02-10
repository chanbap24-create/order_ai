import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

interface InventoryItem {
  item_no: string;
  item_name: string;
  available_stock: number;
  bonded_warehouse: number;
  updated_at: string;
}

interface InventoryStats {
  total_items: number;
  total_available_stock: number;
  total_bonded_warehouse: number;
  items_with_stock: number;
  items_out_of_stock: number;
}

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
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    
    // Build WHERE clause
    let whereConditions = [];
    let params: any[] = [];
    
    if (search) {
      whereConditions.push('(item_no LIKE ? OR item_name LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    // Stock filter
    switch (stockFilter) {
      case 'in_stock':
        whereConditions.push('(available_stock > 0 OR bonded_warehouse > 0)');
        break;
      case 'out_of_stock':
        whereConditions.push('(available_stock = 0 AND bonded_warehouse = 0)');
        break;
      case 'bonded_only':
        whereConditions.push('bonded_warehouse > 0');
        break;
      // 'all' - no filter
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM inventory ${whereClause}`;
    const countResult = db.prepare(countQuery).get(...params) as { total: number };
    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get paginated data
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        item_no,
        item_name,
        available_stock,
        bonded_warehouse,
        updated_at
      FROM inventory
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const items = db.prepare(dataQuery).all(...params, limit, offset) as InventoryItem[];
    
    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_items,
        SUM(available_stock) as total_available_stock,
        SUM(bonded_warehouse) as total_bonded_warehouse,
        SUM(CASE WHEN available_stock > 0 OR bonded_warehouse > 0 THEN 1 ELSE 0 END) as items_with_stock,
        SUM(CASE WHEN available_stock = 0 AND bonded_warehouse = 0 THEN 1 ELSE 0 END) as items_out_of_stock
      FROM inventory
      ${whereClause}
    `;
    
    const stats = db.prepare(statsQuery).get(...params) as InventoryStats;
    
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
          total_items: stats.total_items || 0,
          total_available_stock: stats.total_available_stock || 0,
          total_bonded_warehouse: stats.total_bonded_warehouse || 0,
          items_with_stock: stats.items_with_stock || 0,
          items_out_of_stock: stats.items_out_of_stock || 0,
        },
        filters: {
          search,
          stock_filter: stockFilter,
          sort: sortColumn,
          order: sortOrder,
        },
      },
    });
    
  } catch (error) {
    console.error('❌ Inventory API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
