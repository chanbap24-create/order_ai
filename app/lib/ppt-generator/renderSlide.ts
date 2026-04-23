import type { SlideData } from "./theme";
import { renderHeader } from "./sections/header";
import { renderInfo } from "./sections/info";
import { renderTasting } from "./sections/tasting";
import { renderFooter } from "./sections/footer";

/**
 * 단일 테이스팅 노트 슬라이드 렌더링.
 * Header → Info(지역/품종/빈티지/양조) → Tasting Note → Awards/Footer/Bottle.
 */
export function addTastingNoteSlide(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pptx: any,
  data: SlideData,
) {
  const slide = pptx.addSlide();
  renderHeader(slide, data);
  renderInfo(slide, data);
  renderTasting(slide, data);
  renderFooter(slide, data);
}
