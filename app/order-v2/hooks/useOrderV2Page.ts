import { useCallback, useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_MS } from "../constants";
import {
  removeLineAt,
  replaceWithSearchResult,
  setQuantity,
  setSelected,
  setSelectedSupplyPrice,
} from "../lib/lineOps";
import { buildStaffMessage } from "../lib/staffMessage";
import type { OrderTab, SearchResult } from "../types";
import { useAutoPaste } from "./useAutoPaste";
import { useClientHistory } from "./useClientHistory";
import { useClientSearch } from "./useClientSearch";
import { useDeliveryDate } from "./useDeliveryDate";
import { useItemEditor } from "./useItemEditor";
import { useOrderParse } from "./useOrderParse";
import { useWineSearch } from "./useWineSearch";

/**
 * 페이지 전역 상태 + 핸들러를 한 곳에서 조립하는 훅.
 * UI 컴포넌트는 이 훅이 반환하는 값으로만 렌더한다.
 */
export function useOrderV2Page() {
  const [tab, setTab] = useState<OrderTab>("CDV");

  // 입력: 발주 본문
  const [orderText, setOrderText] = useState("");
  const orderTextRef = useRef<HTMLTextAreaElement>(null);
  const autoPaste = useAutoPaste(orderText, setOrderText);

  // 거래처 / 입고내역 / 배송
  const client = useClientSearch(tab);
  const history = useClientHistory(client.selected?.client_code, tab);
  const delivery = useDeliveryDate(tab);

  // 파싱 결과
  const parse = useOrderParse();
  const editor = useItemEditor();
  const wineSearch = useWineSearch(tab);

  // 토큰 및 UI 상태
  const [copied, setCopied] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [showDeliveryNotes, setShowDeliveryNotes] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // 탭 변경 시 거래처/입고내역 리셋
  useEffect(() => {
    client.reset();
    history.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // 붙여넣기 버튼 (키보드 또는 Clipboard API)
  const pasteFromClipboard = async () => {
    const ta = orderTextRef.current;
    if (ta) {
      ta.focus();
      ta.select();
      const ok = document.execCommand("paste");
      if (ok) return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) setOrderText(text.trim());
    } catch {
      alert("클립보드 접근 권한이 필요합니다.");
    }
  };

  // 파싱 실행
  const handleParse = useCallback(() => {
    editor.setDiscountRates({});
    wineSearch.close();
    return parse.run({
      tab,
      orderText,
      selectedClient: client.selected,
      clientQuery: client.query,
    });
  }, [tab, orderText, client.selected, client.query, editor, wineSearch, parse]);

  // 라인 조작 래퍼 (lineOps를 setOrderLines와 연결)
  const selectCandidate = (lineIdx: number, candIdx: number) =>
    parse.setOrderLines((prev) => setSelected(prev, lineIdx, candIdx));

  const replaceWithSearch = (lineIdx: number, wine: SearchResult) => {
    parse.setOrderLines((prev) => replaceWithSearchResult(prev, lineIdx, wine));
    wineSearch.close();
  };

  const removeLine = (idx: number) =>
    parse.setOrderLines((prev) => removeLineAt(prev, idx));

  const updateQty = (idx: number, qty: number) =>
    parse.setOrderLines((prev) => setQuantity(prev, idx, qty));

  const updatePrice = (lineIdx: number, price: number) =>
    parse.setOrderLines((prev) => setSelectedSupplyPrice(prev, lineIdx, price));

  // 직원 메시지 빌드
  const staffMessage = buildStaffMessage({
    orderLines: parse.orderLines,
    tab,
    selectedClient: client.selected,
    clientQuery: client.query,
    discountRates: editor.discountRates,
    historySet: parse.historySet,
    finalDeliveryLabel: delivery.finalLabel,
    deliveryNotes,
  });

  const copyMessage = () => {
    navigator.clipboard.writeText(staffMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const handleReset = () => {
    client.reset();
    setOrderText("");
    parse.reset();
    editor.reset();
    wineSearch.close();
    delivery.reset();
    history.reset();
    setDeliveryNotes("");
    setShowDeliveryDate(false);
    setShowDeliveryNotes(false);
  };

  return {
    // 기본
    tab,
    setTab,
    orderText,
    setOrderText,
    orderTextRef,
    autoPaste,
    pasteFromClipboard,
    // 도메인 훅
    client,
    history,
    delivery,
    parse,
    editor,
    wineSearch,
    // 페이지 전용
    copied,
    copyMessage,
    staffMessage,
    deliveryNotes,
    setDeliveryNotes,
    showDeliveryDate,
    setShowDeliveryDate,
    showDeliveryNotes,
    setShowDeliveryNotes,
    // 핸들러
    handleParse,
    handleReset,
    selectCandidate,
    replaceWithSearch,
    removeLine,
    updateQty,
    updatePrice,
  };
}
