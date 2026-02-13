// app/api/admin/upload-data/[type]/route.ts
// 클라이언트에서 파싱된 JSON 데이터를 받아 DB에 저장 (대용량 파일 대응)
import { NextRequest, NextResponse } from "next/server";
import { processClientFromData, processDlClientFromData } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;

    if (type !== 'client' && type !== 'dl-client') {
      return NextResponse.json(
        { success: false, error: `이 엔드포인트는 client/dl-client만 지원합니다.` },
        { status: 400 }
      );
    }

    const body = await request.json();
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
