// app/api/interpret-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { interpretOrder, OrderInterpretation } from '@/app/lib/orderInterpreter';
import { logger } from '@/app/lib/logger';

/**
 * GET: API 상태 확인
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Order Interpreter API is running. Use POST method to interpret orders.',
    version: '1.0.0',
  });
}

/**
 * POST: 발주 해석
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 파싱
    const body = await request.json();
    const { raw_order_text, client_code } = body;

    // 2. 입력 검증
    if (!raw_order_text || typeof raw_order_text !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'raw_order_text is required and must be a string',
        },
        { status: 400 }
      );
    }

    if (raw_order_text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'raw_order_text cannot be empty',
        },
        { status: 400 }
      );
    }

    // 3. 발주 해석 실행
    logger.info('Interpreting order', {
      textLength: raw_order_text.length,
      clientCode: client_code || 'unknown',
    });

    const startTime = Date.now();
    const result: OrderInterpretation = await interpretOrder(
      raw_order_text,
      client_code
    );
    const duration = Date.now() - startTime;

    // 4. 응답 반환
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        processing_time_ms: duration,
        items_count: result.items.length,
        auto_confirmed_count: result.items.filter(i => i.auto_confirm).length,
        needs_review: result.needs_review,
      },
    });
  } catch (error) {
    logger.error('Order interpretation API error', { error });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
