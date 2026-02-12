/**
 * GET /api/list-new-items
 *
 * 신규 품목 학습 내역 조회
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET() {
  try {
    // client_item_stats 테이블에서 신규 품목 조회
    // LEFT JOIN client on client_code → Supabase embedded select if FK exists,
    // otherwise two queries. Using a simple approach:
    const { data: rows, error } = await supabase
      .from('client_item_stats')
      .select(`
        client_code,
        item_no,
        item_name,
        supply_price,
        updated_at
      `)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Enrich with client_name if client table exists
    // Try to fetch client names for the client_codes we got
    const clientCodes = [...new Set((rows || []).map((r: any) => r.client_code))];
    let clientMap: Record<string, string> = {};

    if (clientCodes.length > 0) {
      try {
        const { data: clients } = await supabase
          .from('client')
          .select('client_code, client_name')
          .in('client_code', clientCodes);
        if (clients) {
          for (const c of clients) {
            clientMap[c.client_code] = c.client_name;
          }
        }
      } catch {
        // client table may not exist, ignore
      }
    }

    const enrichedRows = (rows || []).map((r: any) => ({
      ...r,
      client_name: clientMap[r.client_code] || null,
    }));

    return NextResponse.json({
      success: true,
      rows: enrichedRows,
      count: enrichedRows.length
    });

  } catch (error: any) {
    console.error('[list-new-items] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
