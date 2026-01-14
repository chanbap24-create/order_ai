/**
 * GET /api/list-new-items
 * 
 * 신규 품목 학습 내역 조회
 */

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // client_item_stats 테이블에서 신규 품목 조회
    const rows = db.prepare(`
      SELECT 
        cis.client_code,
        cis.item_no,
        cis.item_name,
        cis.supply_price,
        cis.updated_at,
        c.client_name
      FROM client_item_stats cis
      LEFT JOIN client c ON c.client_code = cis.client_code
      ORDER BY cis.updated_at DESC
      LIMIT 100
    `).all();

    return NextResponse.json({
      success: true,
      rows: rows || [],
      count: rows?.length || 0
    });

  } catch (error: any) {
    console.error('[list-new-items] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
