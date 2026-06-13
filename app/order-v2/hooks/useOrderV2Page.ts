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
import type { HistoryItem, OrderLine, OrderTab, SearchResult } from "../types";
import type { IntakeResult } from "../lib/api";
import { learnOrderCorrections } from "../lib/api";
import { useAutoPaste } from "./useAutoPaste";
import { useAutoSingle } from "./useAutoSingle";
import { useClientHistory } from "./useClientHistory";
import { useClientSearch } from "./useClientSearch";
import { useDeliveryDate } from "./useDeliveryDate";
import { useImageIntake } from "./useImageIntake";
import { useOrderBatch } from "./useOrderBatch";
import { useItemEditor } from "./useItemEditor";
import { useOrderParse } from "./useOrderParse";
import { useWineSearch } from "./useWineSearch";

const AUTO_MODE_KEY = "orderv2_auto_mode"; // 자동 모드 ON/OFF 마지막 선택 기억

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

  // 스샷 추출 → 거래처힌트 자동매칭 + 발주텍스트 채움 (단건)
  const applyExtraction = useCallback(
    (r: IntakeResult) => {
      setOrderText(r.order_text);
      if (r.client_hint) void client.applyHint(r.client_hint);
    },
    [client],
  );
  const imageIntake = useImageIntake(applyExtraction);
  const batch = useOrderBatch();

  // 자동 모드 ON/OFF — 마지막 선택을 localStorage 에 기억 (SSR 불일치 방지 위해 마운트 후 로드)
  const [autoMode, setAutoMode] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(AUTO_MODE_KEY) === "1") setAutoMode(true); } catch { /* 무시 */ }
  }, []);

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

  /**
   * 입고내역 row 클릭 시 발주 라인으로 직접 추가.
   * parse 없이도 즉시 라인이 생기고 selectedIdx=0 으로 확정 상태.
   * 동일 item_no 가 이미 있으면 수량만 +1.
   */
  const addLineFromHistory = (item: HistoryItem) => {
    parse.setOrderLines((prev) => {
      const existing = prev.findIndex(
        (ol) => ol.candidates[ol.selectedIdx]?.item_no === item.item_no,
      );
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      const newLine: OrderLine = {
        query: item.item_name,
        quantity: 1,
        candidates: [
          {
            item_no: item.item_no,
            item_name: item.item_name,
            confidence: 1,
            supply_price: item.supply_price || 0,
            available_stock: 0,
            reasoning: "입고내역에서 직접 추가",
          },
        ],
        selectedIdx: 0,
      };
      return [...prev, newLine];
    });
  };

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
    // 확정(복사) 시점에 정정 학습 — 다음 파싱부터 자동 반영
    learnOrderCorrections(parse.orderLines);
  };

  // 자동(단건) 오케스트레이션 — staffMessage 준비된 뒤 인스턴스화. 결과는 배치와 공용 노출.
  const auto = useAutoSingle({
    tab,
    staffMessage,
    selectedClient: client.selected,
    parseLoading: parse.loading,
    orderLines: parse.orderLines,
    setOrderText,
    setSelectedClient: client.setSelected,
    setClientQuery: client.setQuery,
    resetDiscounts: () => editor.setDiscountRates({}),
    closeSearch: wineSearch.close,
    runParse: parse.run,
  });
  const { run: autoRun, autoBusy, result: autoSingleResult, clear: autoClear } = auto;
  const clearAutoResult = useCallback(() => { autoClear(); batch.clearAutoResult(); }, [autoClear, batch]);

  // 스샷 처리. 자동 ON → 1장 단건 상세 자동 / 2장+ 배치 자동. 자동 OFF → 수동.
  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (autoMode) {
        if (files.length === 1) void autoRun(files[0]);
        else void batch.startAuto(files, tab);
        return;
      }
      if (files.length === 1) void imageIntake.processFile(files[0]);
      else void batch.start(files, tab);
    },
    [autoMode, autoRun, imageIntake, batch, tab],
  );
  const toggleAutoMode = useCallback((v: boolean) => {
    setAutoMode(v);
    try { localStorage.setItem(AUTO_MODE_KEY, v ? "1" : "0"); } catch { /* 무시 */ }
    if (!v) clearAutoResult();
  }, [clearAutoResult]);
  const autoResult = autoSingleResult ?? batch.autoResult;

  const handleReset = () => {
    client.reset();
    setOrderText("");
    parse.reset();
    editor.reset();
    wineSearch.close();
    delivery.reset();
    history.reset();
    batch.clear();
    clearAutoResult();
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
    imageIntake,
    batch,
    handleFiles,
    autoMode,
    toggleAutoMode,
    autoResult,
    clearAutoResult,
    autoBusy,
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
    addLineFromHistory,
  };
}
