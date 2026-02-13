// app/api/admin/upload-data/[type]/route.ts
// 클라이언트에서 파싱된 JSON 데이터를 받아 DB에 저장 (대용량 파일 대응)
import { NextRequest, NextResponse } from "next/server";
import { processClientFromData, processDlClientFromData, processShipmentsFromData } from "@/app/lib/adminUpload";
import type { ShipmentRow } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";

const VALID_TYPES = ['client', 'dl-client', 'client-shipments', 'dl-client-shipments'] as const;

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

    // Shipments 배치 업로드
    if (type === 'client-shipments' || type === 'dl-client-shipments') {
      const { shipments, clear } = body as { shipments: ShipmentRow[]; clear: boolean };

      if (!shipments || !Array.isArray(shipments)) {
        return NextResponse.json(
          { success: false, error: 'shipments 배열이 필요합니다.' },
          { status: 400 }
        );
      }

      const table = type === 'client-shipments' ? 'shipments' : 'glass_shipments';
      logger.info(`Admin upload-data: type=${type}, rows=${shipments.length}, clear=${clear}`);

      const result = await processShipmentsFromData(shipments, table, !!clear);
      return NextResponse.json({ success: true, type, ...result });
    }

    // 기존 client/dl-client 처리
    const { clients, items } = body;

    if (!clients || !items) {
      return NextResponse.json(
        { success: false, error: 'clients, items 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    logger.info(`Admin upload-data: type=${type}, clients=${Object.keys(clients).length}, items=${items.length}`);

    let result;
    if (type === 'client') {
      result = await processClientFromData(clients, items);
    } else {
      result = await processDlClientFromData(clients, items);
    }

    return NextResponse.json({ success: true, type, ...result });
  } catch (e) {
    logger.error("Admin upload-data error", e instanceof Error ? e : undefined);
    return handleApiError(e);
  }
}
