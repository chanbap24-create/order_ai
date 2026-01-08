/**
 * ========================================
 * 자동 학습 API 엔드포인트
 * ========================================
 * 
 * POST /api/auto-learn
 * 사용자가 후보를 선택했을 때 자동으로 토큰 매핑 학습
 */

import { NextRequest, NextResponse } from "next/server";
import { learnFromSelection } from "@/app/lib/autoLearn";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const {
      query,
      selectedItem,
      rejectedItems = [],
      clientCode,
      features = {}
    } = body;
    
    // 필수 파라미터 확인
    if (!query || !selectedItem || !selectedItem.item_no || !selectedItem.item_name) {
      return NextResponse.json(
        {
          success: false,
          error: "query, selectedItem.item_no, selectedItem.item_name required"
        },
        { status: 400 }
      );
    }
    
    if (!clientCode) {
      return NextResponse.json(
        {
          success: false,
          error: "clientCode required"
        },
        { status: 400 }
      );
    }
    
    // 자동 학습 실행
    const result = learnFromSelection({
      query,
      selectedItem: {
        item_no: selectedItem.item_no,
        item_name: selectedItem.item_name
      },
      rejectedItems: Array.isArray(rejectedItems) ? rejectedItems : [],
      clientCode,
      features
    });
    
    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error: any) {
    console.error("[API /auto-learn] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
