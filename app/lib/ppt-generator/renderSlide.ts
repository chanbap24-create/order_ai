import type { SlideData } from "./theme";
import { renderHeader } from "./sections/header";
import { renderInfo } from "./sections/info";
import { renderFooter } from "./sections/footer";

/**
 * 단일 테이스팅 노트 슬라이드 렌더링.
 * Header → Info(본문 전체: 지역~테이스팅~푸드, 적응형 흐름) → Awards/Footer/Bottle.
 */
export function addTastingNoteSlide(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pptx: any,
  data: SlideData,
) {
  const slide = pptx.addSlide();
  renderHeader(slide, data);
  renderInfo(slide, data);
  renderFooter(slide, data);
}
