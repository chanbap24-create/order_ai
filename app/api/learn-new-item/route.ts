/**
 * POST /api/learn-new-item
 * 
 * 신규 품목 학습: English 시트에서 찾은 품목을 거래처 입고 이력에 추가
 * 
 * Body:
 * {
 *   clientCode: string;       // 거래처 코드 (예: "10001")
 *   selectedItemNo: string;   // 선택한 품목 코드 (예: "3A14009")
 *   selectedName: string;     // 선택한 품목명 (예: "샤또마르고 / Chateau Margaux (2014)")
 *   supplyPrice?: number;     // 공급가 (선택사항)
 * }
 * 
 * 동작:
 * - client_item_stats 테이블에 저장 (거래처 입고 이력)
 * - 다음 검색 시 자동으로 후보에 포함됨 ✅
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from "@/app/lib/api-response";
import { db } from '@/app/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientCode, inputName, selectedItemNo, selectedName, supplyPrice } = body;

    // 필수 필드 검증
    if (!clientCode || !selectedItemNo || !selectedName) {
      return jsonResponse(
        { 
          success: false, 
          error: 'Missing required fields: clientCode, selectedItemNo, selectedName' 
        },
        { status: 400 }
      );
    }

    // ✅ 핵심: client_item_stats에 저장 (거래처 입고 이력에 추가)
    // 이렇게 하면 다음 검색 시 자동으로 후보에 포함됩니다!
    const insertStats = db.prepare(`
      INSERT INTO client_item_stats (client_code, item_no, item_name, supply_price, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(client_code, item_no) 
      DO UPDATE SET 
        item_name = excluded.item_name,
        supply_price = excluded.supply_price,
        updated_at = CURRENT_TIMESTAMP
    `);

    const statsResult = insertStats.run(
      clientCode, 
      selectedItemNo, 
      selectedName, 
      supplyPrice || null
    );

    // 저장된 데이터 조회
    const saved = db.prepare(`
      SELECT * FROM client_item_stats 
      WHERE client_code = ? AND item_no = ?
    `).get(clientCode, selectedItemNo);

    return jsonResponse({
      success: true,
      message: '신규 품목이 거래처 입고 이력에 추가되었습니다. 다음 검색부터 자동 매칭됩니다.',
      saved: statsResult.changes,
      data: saved,
    });

  } catch (error: any) {
    console.error('[learn-new-item] Error:', error);
    return jsonResponse(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
