// PPT 생성기 - pptxgenjs 기반 (Vercel 서버리스 호환)
// python-pptx (child_process) → pptxgenjs (pure JS) 마이그레이션

import PptxGenJS from "pptxgenjs";
import { logger } from "@/app/lib/logger";

import { SLIDE_W, SLIDE_H } from "./ppt-generator/theme";
import { addTastingNoteSlide } from "./ppt-generator/renderSlide";
import { buildSlidesFromWineIds } from "./ppt-generator/slideBuilder";

/** 단일 와인 테이스팅 노트 PPT 생성 */
export async function generateSingleWinePpt(wineId: string): Promise<Buffer> {
  return generateTastingNotePpt([wineId]);
}

/** 여러 와인의 테이스팅 노트 PPT 생성 */
export async function generateTastingNotePpt(wineIds: string[]): Promise<Buffer> {
  const slides = await buildSlidesFromWineIds(wineIds);
  if (slides.length === 0) {
    throw new Error("생성할 슬라이드가 없습니다.");
  }

  // Presentation 생성
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_PORTRAIT", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "A4_PORTRAIT";

  for (const data of slides) {
    addTastingNoteSlide(pptx, data);
  }

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  logger.info(`PPT generated: ${slides.length} slides (pptxgenjs)`);

  return output;
}
