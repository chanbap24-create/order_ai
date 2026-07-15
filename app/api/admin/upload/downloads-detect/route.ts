import { NextResponse, after } from "next/server";
import { detectNewWines, detectPriceChanges } from "@/app/lib/wineDetection";
import { enrichWinesAfterSync } from "@/app/lib/wineEnrichSync";
import { logger } from "@/app/lib/logger";

export const maxDuration = 300;

// Downloads 업로드 완료 후 신규 와인 감지 + 가격 변동 감지
export async function POST() {
  try {
    const priceChangesDetected = await detectPriceChanges();
    logger.info(`[Downloads-Detect] Price changes: ${priceChangesDetected}`);

    const detection = await detectNewWines();
    logger.info(`[Downloads-Detect] New: ${detection.newCount}, Updated: ${detection.updatedCount}`);

    // 와인리스트 빈칸 보강(형제 상속·테이스팅 노트·LLM)은 응답 후 백그라운드로 —
    // 노트 다운로드·LLM 호출이 수 분 걸려 업로드 UI를 잡아먹던 문제 방지.
    after(async () => {
      try {
        const e = await enrichWinesAfterSync();
        logger.info(`[Downloads-Detect] enrich(후처리): inherited=${e.inherited}, note=${e.noteFilled}, gpt=${e.gptFilled}`);
      } catch (err) {
        logger.warn(`[Downloads-Detect] enrich 후처리 실패(비치명): ${err instanceof Error ? err.message : err}`);
      }
    });

    return NextResponse.json({
      newWinesDetected: detection.newCount,
      priceChangesDetected,
    });
  } catch (e) {
    logger.error("Wine detection failed", e instanceof Error ? e : undefined);
    return NextResponse.json({ newWinesDetected: 0, priceChangesDetected: 0 });
  }
}
