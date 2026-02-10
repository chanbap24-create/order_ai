// app/api/admin/upload/[type]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processUpload, isValidUploadType, UPLOAD_TYPES } from "@/app/lib/adminUpload";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";
import { detectNewWines, detectPriceChanges } from "@/app/lib/wineDetection";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;

    if (!isValidUploadType(type)) {
      return NextResponse.json(
        { success: false, error: `지원하지 않는 업로드 타입: ${type}`, validTypes: Object.keys(UPLOAD_TYPES) },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: "파일이 첨부되지 않았습니다." }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return NextResponse.json({ success: false, error: "허용되지 않는 파일 형식입니다. (.xlsx, .xls, .csv만 가능)" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "파일 크기가 50MB를 초과합니다." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info(`Admin upload: type=${type}, file=${file.name}, size=${file.size}`);
    const result = processUpload(type, buffer);

    // Downloads(와인재고현황) 업로드 시 신규 와인 감지 + 가격 변동 감지
    let newWinesDetected = 0;
    let priceChangesDetected = 0;
    if (type === "downloads") {
      try {
        priceChangesDetected = detectPriceChanges();
        const detection = detectNewWines();
        newWinesDetected = detection.newCount;
      } catch (e) {
        logger.warn("Wine detection after downloads upload failed", { error: e });
      }
    }

    return NextResponse.json({
      success: true,
      type,
      label: UPLOAD_TYPES[type].label,
      fileName: file.name,
      fileSize: file.size,
      ...result,
      ...(type === "downloads" && { newWinesDetected, priceChangesDetected }),
    });
  } catch (e) {
    logger.error("Admin upload error", e instanceof Error ? e : undefined);
    return handleApiError(e);
  }
}
