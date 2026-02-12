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
 * - 다음 검색 시 자동으로 후보에 포함됨
 */

import { NextRequest } from 'next/server';
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from '@/app/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientCode, selectedItemNo, selectedName, supplyPrice } = body;

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

    // client_item_stats에 upsert (거래처 입고 이력에 추가)
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('client_item_stats')
      .upsert(
        {
          client_code: clientCode,
          item_no: selectedItemNo,
          item_name: selectedName,
          supply_price: supplyPrice || null,
          updated_at: now,
        },
        { onConflict: 'client_code,item_no' }
      );

    if (upsertError) throw upsertError;

    // 저장된 데이터 조회
    const { data: saved } = await supabase
      .from('client_item_stats')
      .select('*')
      .eq('client_code', clientCode)
      .eq('item_no', selectedItemNo)
      .maybeSingle();

    return jsonResponse({
      success: true,
      message: '신규 품목이 거래처 입고 이력에 추가되었습니다. 다음 검색부터 자동 매칭됩니다.',
      saved: saved ? 1 : 0,
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
