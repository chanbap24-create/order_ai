// app/api/admin/upload-data/[type]/route.ts
// 클라이언트에서 파싱된 JSON 데이터를 받아 DB에 저장 (대용량 파일 대응)
import { NextRequest, NextResponse } from "next/server";
import { processClientFromData, processDlClientFromData, processShipmentsFromData, processPaymentsFromData, processCarryoverFromData, processDlPaymentsFromData, processDlCarryoverFromData } from "@/app/lib/adminUpload";
import type { ShipmentRow, PaymentRow, CarryoverRow } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";

const VALID_TYPES = ['client', 'dl-client', 'client-shipments', 'dl-client-shipments', 'payments', 'dl-payments'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;

    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `지원하지 않는 타입: ${type}` },
        { status: 400 }
      );
    }

    const body = await request.json();

    // 수금내역 업로드 (이월 미수금 포함)
    if (type === 'payments') {
      const { payments, carryovers, mode, minDate } = body as { payments: PaymentRow[]; carryovers?: CarryoverRow[]; mode?: string; minDate?: string };
      if (!payments || !Array.isArray(payments)) {
        return NextResponse.json(
          { success: false, error: 'payments 배열이 필요합니다.' },
          { status: 400 }
        );
      }
      const append = mode === 'append';
      logger.info(`Admin upload-data: type=payments, rows=${payments.length}, carryovers=${carryovers?.length || 0}, mode=${mode || 'replace'}, minDate=${minDate || 'none'}`);
      const result = await processPaymentsFromData(payments, append, minDate);
      let carryoverResult = null;
      // append 모드에서는 이월 미수금을 건드리지 않음 (수금만 추가)
      if (!append && carryovers && carryovers.length > 0) {
        carryoverResult = await processCarryoverFromData(carryovers, append);
      }
      return NextResponse.json({ success: true, type, ...result, carryover: carryoverResult, carryover_skipped: append ? true : undefined });
    }

    // DL(RIEDEL) 수금내역 업로드
    if (type === 'dl-payments') {
      const { payments, carryovers, mode, minDate } = body as { payments: PaymentRow[]; carryovers?: CarryoverRow[]; mode?: string; minDate?: string };
      if (!payments || !Array.isArray(payments)) {
        return NextResponse.json(
          { success: false, error: 'payments 배열이 필요합니다.' },
          { status: 400 }
        );
      }
      const append = mode === 'append';
      logger.info(`Admin upload-data: type=dl-payments, rows=${payments.length}, carryovers=${carryovers?.length || 0}, mode=${mode || 'replace'}, minDate=${minDate || 'none'}`);
      const result = await processDlPaymentsFromData(payments, append, minDate);
      let carryoverResult = null;
      // append 모드에서는 이월 미수금을 건드리지 않음
      if (!append && carryovers && carryovers.length > 0) {
        carryoverResult = await processDlCarryoverFromData(carryovers, append);
      }
      return NextResponse.json({ success: true, type, ...result, carryover: carryoverResult, carryover_skipped: append ? true : undefined });
    }

    // Shipments 배치 업로드
    if (type === 'client-shipments' || type === 'dl-client-shipments') {
      const { shipments, clear, minDate } = body as { shipments: ShipmentRow[]; clear: boolean; minDate?: string };

      if (!shipments || !Array.isArray(shipments)) {
        return NextResponse.json(
          { success: false, error: 'shipments 배열이 필요합니다.' },
          { status: 400 }
        );
      }

      const table = type === 'client-shipments' ? 'shipments' : 'glass_shipments';
      logger.info(`Admin upload-data: type=${type}, rows=${shipments.length}, clear=${clear}, minDate=${minDate || 'none'}`);

      const result = await processShipmentsFromData(shipments, table, !!clear, minDate);
      return NextResponse.json({ success: true, type, ...result });
    }

    // 기존 client/dl-client 처리
    const { clients, items, mode } = body;
    const append = mode === 'append';

    if (!clients || !items) {
      return NextResponse.json(
        { success: false, error: 'clients, items 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    logger.info(`Admin upload-data: type=${type}, clients=${Object.keys(clients).length}, items=${items.length}`);

    let result;
    if (type === 'client') {
      result = await processClientFromData(clients, items, append);
    } else {
      result = await processDlClientFromData(clients, items, append);
    }

    return NextResponse.json({ success: true, type, ...result });
  } catch (e) {
    logger.error("Admin upload-data error", e instanceof Error ? e : undefined);
    return handleApiError(e);
  }
}
