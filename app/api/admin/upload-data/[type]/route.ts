// app/api/admin/upload-data/[type]/route.ts
// 클라이언트에서 파싱된 JSON 데이터를 받아 DB에 저장 (대용량 파일 대응)
import { NextRequest, NextResponse } from "next/server";
import { processClientFromData, processDlClientFromData, processShipmentsFromData, processPaymentsFromData, processCarryoverFromData, processDlPaymentsFromData, processDlCarryoverFromData, processClientInfoFromData } from "@/app/lib/adminUpload";
import type { ShipmentRow, PaymentRow, CarryoverRow, ClientInfoRow } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";
import { supabase } from "@/app/lib/db";

const VALID_TYPES = ['client', 'dl-client', 'client-shipments', 'dl-client-shipments', 'payments', 'dl-payments', 'downloads', 'dl', 'client-info', 'dl-client-info'] as const;

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

    // 재고현황 업로드 (브라우저에서 파싱된 JSON 수신)
    if (type === 'downloads' || type === 'dl') {
      const { rows, append } = body as { rows: Record<string, unknown>[]; append?: boolean };
      if (!rows || !Array.isArray(rows)) {
        return NextResponse.json({ success: false, error: '재고 데이터(rows)가 필요합니다.' }, { status: 400 });
      }
      // 빈 배열이면 이전 청크에서 이미 처리 완료 — 성공 응답만 반환
      if (rows.length === 0) {
        return NextResponse.json({ success: true, type, items: 0 });
      }
      logger.info(`Admin upload-data: type=${type}, rows=${rows.length}, append=${!!append}`);

      // append=true이면 기존 데이터 유지하고 upsert만
      const table = type === 'downloads' ? 'inventory_cdv' : 'inventory_dl';
      if (!append) {
        // 삭제 전 1행 dry-run upsert — 컬럼 불일치/스키마 오류면 기존 데이터를 지우지 않고 실패시킨다.
        //   (과거: 삭제 후 upsert 실패 → 재고 테이블이 빈 채로 남는 사고)
        const { error: dryErr } = await supabase.from(table).upsert([rows[0]], { onConflict: 'item_no' });
        if (dryErr) {
          return NextResponse.json(
            { success: false, error: `업로드 사전 검증 실패(기존 데이터 유지됨): ${dryErr.message}` },
            { status: 400 },
          );
        }
        // 첫 번째 청크: 기존 데이터 삭제
        await supabase.from(table).delete().not('item_no', 'is', null);
      }
      // upsert
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'item_no' });
        if (error) throw new Error(`${table} upsert failed: ${error.message}`);
      }

      // wine detection은 클라이언트에서 모든 청크 완료 후 /downloads-detect로 별도 호출
      return NextResponse.json({ success: true, type, items: rows.length });
    }

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

    // 거래처정보 업로드 (ERP 명부 → 세일즈 마스터 갱신)
    if (type === 'client-info' || type === 'dl-client-info') {
      const { rows } = body as { rows: ClientInfoRow[] };
      if (!rows || !Array.isArray(rows)) {
        return NextResponse.json({ success: false, error: '거래처정보(rows)가 필요합니다.' }, { status: 400 });
      }
      logger.info(`Admin upload-data: type=${type}, rows=${rows.length}`);
      const result = await processClientInfoFromData(rows, type === 'dl-client-info');
      return NextResponse.json({ success: true, type, ...result });
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
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Admin upload-data error", e instanceof Error ? e : undefined);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
