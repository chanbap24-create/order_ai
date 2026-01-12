/**
 * POST /api/search-new-item
 * 
 * 신규 품목 검색: English 시트에서 유사한 품목 찾기
 * 
 * Body:
 * {
 *   inputName: string;  // 검색할 품목명 (예: "샤또마르고")
 *   topN?: number;      // 반환할 후보 개수 (기본 5개)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchMasterSheet } from '@/app/lib/masterMatcher';
import { jsonResponse } from '@/app/lib/api-response';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inputName, topN = 5 } = body;

    if (!inputName) {
      return jsonResponse(
        { success: false, error: 'Missing required field: inputName' },
        { status: 400 }
      );
    }

    const candidates = searchMasterSheet(inputName, topN);

    return jsonResponse({
      success: true,
      inputName,
      candidates,
      count: candidates.length,
    });

  } catch (error: any) {
    console.error('[search-new-item] Error:', error);
    return jsonResponse(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
