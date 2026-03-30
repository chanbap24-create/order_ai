import { NextResponse } from "next/server";
import { detectNewWines, detectPriceChanges } from "@/app/lib/wineDetection";
import { logger } from "@/app/lib/logger";

// Downloads 업로드 완료 후 신규 와인 감지 + 가격 변동 감지
export async function POST() {
  try {
    const priceChangesDetected = await detectPriceChanges();
    logger.info(`[Downloads-Detect] Price changes: ${priceChangesDetected}`);

    const detection = await detectNewWines();
    logger.info(`[Downloads-Detect] New: ${detection.newCount}, Updated: ${detection.updatedCount}`);

    return NextResponse.json({
      newWinesDetected: detection.newCount,
      priceChangesDetected,
    });
  } catch (e) {
    logger.error("Wine detection failed", e instanceof Error ? e : undefined);
    return NextResponse.json({ newWinesDetected: 0, priceChangesDetected: 0 });
  }
}
