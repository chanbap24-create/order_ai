import { useCallback, useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_MS } from "../constants";
import {
  removeLineAt,
  replaceWithSearchResult,
  setQuantity,
  setSelected,
  setSelectedSupplyPrice,
} from "../lib/lineOps";
import { buildStaffMessage, buildClientMessage } from "../lib/staffMessage";
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
  const [clientCopied, setClientCopied] = useState(false);
  const [tastingBusy, setTastingBusy] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [showDeliveryNotes, setShowDeliveryNotes] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // 탭 변경 시 거래처/입고내역 리셋
  useEffect(() => {
    client.reset();
    history.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // 거래처 선택 시 입고내역 자동 로드 — 메시지의 '이전 공급가' 규칙에 필요
  useEffect(() => {
    if (client.selected?.client_code) void history.fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.selected?.client_code]);

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

  // 스샷 추출 → 거래처 자동확정(LLM 선택 우선, 애매하면 힌트 퍼지) + 발주텍스트 채움 (단건)
  const applyExtraction = useCallback(
    (r: IntakeResult) => {
      setOrderText(r.order_text);
      void client.selectResolved(r);
    },
    [client],
  );
  const imageIntake = useImageIntake(applyExtraction, tab);
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

  // 시음주를 현재 발주에 한 줄 추가(정책/한도 확인 후 기록) — 자연스럽게 발주와 함께 등록.
  const addTasting = useCallback(async () => {
    const sel = client.selected;
    if (!sel) { alert("거래처를 먼저 선택하세요."); return; }
    setTastingBusy(true);
    try {
      const clientType = tab === "DL" ? "glass" : "wine";
      // 출고일 = 발주 배송일(직접 지정 우선, 없으면 계산된 배송일) → 시음주 결재 지급일자로 사용.
      let shipDate = delivery.customDate || "";
      const dd = delivery.info && delivery.info.date;
      if (!shipDate && dd instanceof Date) {
        shipDate = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
      }
      const res = await fetch("/api/sales/tasting/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_code: sel.client_code, client_type: clientType, client_name: sel.client_name, ship_date: shipDate }),
      });
      const d = await res.json();
      if (!d.ok) { alert(`시음주 추가 실패: ${d.reason || ""}`); return; }
      const w = d.item;
      const label =
        d.source === "ai" ? "거래처 AI 추천"
        : d.source === "favorite" ? "즐겨찾기 기본값"
        : d.source === "manual" ? "수동 지정"
        : "재고순";
      const newIdx = parse.orderLines.length;
      parse.setOrderLines((prev) => [
        ...prev,
        {
          query: "시음주",
          quantity: 1,
          candidates: [{
            item_no: w.item_no, item_name: w.item_name, confidence: 1,
            supply_price: w.supply_price || 0, available_stock: w.available_stock || 0, reasoning: `시음주 · ${label}`,
          }],
          selectedIdx: 0,
        },
      ]);
      editor.setDiscount(newIdx, 100); // 100% 할인 = 시음주
      // 어떻게 골랐는지 알림(진단). note 있으면 같이.
      alert(`시음주 추가: ${w.item_name}\n선정: ${label}${d.note ? `\n(${d.note})` : ""}`);
    } catch {
      alert("시음주 추가에 실패했습니다.");
    } finally {
      setTastingBusy(false);
    }
  }, [client.selected, tab, parse, editor, delivery]);

  // 메시지 빌드 (직원용 + 거래처 전달용 — 같은 파라미터)
  const msgParams = {
    orderLines: parse.orderLines,
    tab,
    selectedClient: client.selected,
    clientQuery: client.query,
    discountRates: editor.discountRates,
    historySet: parse.historySet,
    finalDeliveryLabel: delivery.finalLabel,
    deliveryNotes,
    historyPrices: Object.fromEntries(
      history.items.map((i) => [i.item_no.trim().toUpperCase(), i.supply_price]),
    ),
  };
  const staffMessage = buildStaffMessage(msgParams);
  const clientMessage = buildClientMessage(msgParams);

  const copyMessage = () => {
    navigator.clipboard.writeText(staffMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    // 확정(복사) 시점에 정정 학습 — 다음 파싱부터 자동 반영
    learnOrderCorrections(parse.orderLines);
  };

  const copyClientMessage = () => {
    navigator.clipboard.writeText(clientMessage);
    setClientCopied(true);
    setTimeout(() => setClientCopied(false), COPY_FEEDBACK_MS);
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
    applyExtraction,
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
    clientMessage,
    clientCopied,
    copyClientMessage,
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
    addTasting,
    tastingBusy,
  };
}
