import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT } from "../constants/ui";
import type { QuoteItem } from "../types";

/**
 * 모바일/데스크톱 감지 + 모바일 패널/바텀시트 스크롤락.
 * bottomSheetItem은 Quote 훅에서 관리하지만 스크롤락 deps로 받아온다.
 */
export function useInventoryLayout(params: {
  bottomSheetItem: QuoteItem | null;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(true);
  const [showQuotePanel, setShowQuotePanel] = useState(false);

  // 미디어쿼리 변화 구독
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 모바일 패널 또는 바텀시트 열려있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (showQuotePanel || params.bottomSheetItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showQuotePanel, params.bottomSheetItem]);

  return {
    isMobile,
    quoteOpen,
    setQuoteOpen,
    showQuotePanel,
    setShowQuotePanel,
  };
}
