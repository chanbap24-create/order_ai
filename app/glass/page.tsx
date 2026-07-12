"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildQuickDeliveryDates } from "./lib/deliveryDates";
import { createGlassOrderHandlers } from "./hooks/useGlassOrderHandlers";
import { useClipboard } from "./hooks/useClipboard";
import { useLearnInputs } from "./hooks/useLearnInputs";
import { useClientItems } from "./hooks/useClientItems";
import { useNewBusiness } from "./hooks/useNewBusiness";
import { useOrderOptions } from "./hooks/useOrderOptions";
import { useAddItem } from "./hooks/useAddItem";
import { useOrderAutoEffects } from "./hooks/useOrderAutoEffects";
import { LearningTab } from "./components/LearningTab";
import { OrderTab } from "./components/OrderTab";

export default function Home({ subTab }: { subTab?: "order" | "learning" }) {
  const [text, setText] = useState("");
  const [clientInput, setClientInput] = useState(""); // 거래처 입력칸
  const [force, setForce] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<"order" | "learning">("order");

  // 부모(ORDER 페이지)에서 전달받은 subTab 동기화
  useEffect(() => {
    if (subTab) setActiveTab(subTab);
  }, [subTab]);

  // 거래처 선택(동점/애매) UI용
  const [clientCandidates, setClientCandidates] = useState<any[] | null>(null);
  const [pendingOrderText, setPendingOrderText] = useState<string>("");
  const [pendingPreMessage, setPendingPreMessage] = useState<string>("");

  // 학습된 목록 토글 + 강제 갱신 버전
  const [showLearned, setShowLearned] = useState(false);
  const [learnedVersion, setLearnedVersion] = useState(0);

  // 학습 입력 훅 (JSX 기존 변수명 유지)
  const {
    rows: learnInputs,
    setField: updateLearn,
    reset: resetLearnInputs,
    canSave,
    save: saveLearnInputs,
  } = useLearnInputs(() => {
    setLearnedVersion((v) => v + 1);
    setShowLearned(true);
  });

  // 복사 상태(버튼 텍스트)
  const [copied, setCopied] = useState(false);

  // 클립보드 자동 붙여넣기 훅
  const onInitialPaste = useCallback((clip: string) => setText(clip), []);
  const {
    autoPaste,
    setAutoPaste,
    hasClipboard,
  } = useClipboard(onInitialPaste);

  // 전체 JSON 토글
  const [showJson, setShowJson] = useState(false);

  // 후보 선택 학습 저장 상태 (itemIndex별)
  const [savingPick, setSavingPick] = useState<Record<number, boolean>>({});
  const [savedPick, setSavedPick] = useState<Record<number, boolean>>({});

  // 신규 품목 가격/할인율 입력
  const [newItemPrices, setNewItemPrices] = useState<Record<number, string>>({});
  const [newItemDiscounts, setNewItemDiscounts] = useState<Record<number, number>>({});

  // 더보기 상태 (itemIndex별)
  const [showMoreSuggestions, setShowMoreSuggestions] = useState<Record<number, boolean>>({});

  // 품목 결과/학습 입력 접기
  const [showItemsPanel, setShowItemsPanel] = useState(false);
  const [showLearnInput, setShowLearnInput] = useState(false);

  // 거래처 품목 보기 훅 (JSX는 기존 변수명을 유지하도록 destructure)
  const {
    items: clientItems,
    show: showClientItems,
    setShow: setShowClientItems,
    loading: loadingClientItems,
    load: loadClientItemsFromCode,
  } = useClientItems();
  const loadClientItems = () =>
    loadClientItemsFromCode(data?.client?.client_code);

  // 학습된 거래처 목록
  const [showLearnedClients, setShowLearnedClients] = useState(false);
  const [learnedClientVersion, setLearnedClientVersion] = useState(0);

  // 신규 사업자 훅 (JSX 기존 변수명 유지)
  const {
    enabled: isNewBusiness,
    name: newBusinessName,
    phone: newBusinessPhone,
    email: newBusinessEmail,
    setEnabled: setIsNewBusiness,
    setName: setNewBusinessName,
    setPhone: setNewBusinessPhone,
    setEmail: setNewBusinessEmail,
  } = useNewBusiness();

  // 발주 옵션 훅 (JSX 기존 변수명 유지)
  const {
    customDeliveryDate,
    setCustomDeliveryDate,
    requirePaymentConfirm,
    setRequirePaymentConfirm,
    requireInvoice,
    setRequireInvoice,
    panelOpen: showOrderOptions,
    setPanelOpen: setShowOrderOptions,
    asApiFlags,
  } = useOrderOptions();

  // 품목 직접 추가 훅 (JSX 기존 변수명 유지)
  const {
    target: addingItem,
    qty: addingQty,
    setQty: setAddingQty,
    start: addItemManually,
    cancel: cancelAddItem,
    confirm: confirmAddItem,
  } = useAddItem((line) => setText((prev) => prev + `\n${line}`));

  /** 배송일 빠른 선택 버튼 (마운트 시 오늘 기준 7일간) */
  const quickDeliveryDates = useMemo(() => buildQuickDeliveryDates(), []);

  const {
    run, pickClient, pasteFromClipboard, clearAll,
    copyStaffMessage, applySuggestionToResultUI, learnSelectedAlias,
  } = createGlassOrderHandlers({
    text, clientInput, force, data, pendingPreMessage,
    newBusinessEnabled: isNewBusiness,
    newBusinessValid: () =>
      !isNewBusiness || (!!newBusinessName.trim() && !!newBusinessPhone.trim()),
    newBusinessPayload: () =>
      isNewBusiness
        ? {
            name: newBusinessName.trim(),
            phone: newBusinessPhone.trim(),
            email: newBusinessEmail.trim() || undefined,
          }
        : undefined,
    getApiFlags: asApiFlags,
    getDecorateOptions: () => ({
      customDeliveryDate, requirePaymentConfirm, requireInvoice,
    }),
    setText, setClientInput, setData, setLoading, setCopied,
    setShowJson, setShowItemsPanel, setShowLearnInput,
    setClientCandidates, setPendingOrderText, setPendingPreMessage,
    setSavingPick, setSavedPick,
    setLearnedClientVersion, setLearnedVersion, setShowLearned,
  });

  useOrderAutoEffects({
    data,
    setShowItemsPanel,
    onAutoCopy: copyStaffMessage,
    setNewItemPrices,
  });

  const needsClientPick = data?.status === "needs_review_client";

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "0 16px 32px",
      }}
    >

      {activeTab === "order" && (
        <OrderTab
          text={text}
          setText={setText}
          clientInput={clientInput}
          setClientInput={setClientInput}
          loading={loading}
          autoPaste={autoPaste}
          setAutoPaste={setAutoPaste}
          hasClipboard={hasClipboard}
          data={data}
          copied={copied}
          newBusinessProps={{
            enabled: isNewBusiness,
            name: newBusinessName,
            phone: newBusinessPhone,
            email: newBusinessEmail,
            setEnabled: setIsNewBusiness,
            setName: setNewBusinessName,
            setPhone: setNewBusinessPhone,
            setEmail: setNewBusinessEmail,
          }}
          orderOptionsProps={{
            customDeliveryDate,
            setCustomDeliveryDate,
            requirePaymentConfirm,
            setRequirePaymentConfirm,
            requireInvoice,
            setRequireInvoice,
            panelOpen: showOrderOptions,
            setPanelOpen: setShowOrderOptions,
          }}
          quickDeliveryDates={quickDeliveryDates}
          needsClientPick={needsClientPick}
          clientCandidates={clientCandidates}
          hintUsed={String(data?.client?.hint_used ?? "")}
          pendingOrderText={pendingOrderText}
          showItemsPanel={showItemsPanel}
          setShowItemsPanel={setShowItemsPanel}
          showMoreSuggestions={showMoreSuggestions}
          toggleShowMore={(idx) =>
            setShowMoreSuggestions((prev) => ({ ...prev, [idx]: !prev[idx] }))
          }
          savingPick={savingPick}
          savedPick={savedPick}
          newItemPrices={newItemPrices}
          newItemDiscounts={newItemDiscounts as Record<string, number>}
          onPriceChange={(key, v) => setNewItemPrices((prev) => ({ ...prev, [key]: v }))}
          onDiscountChange={(key, v) =>
            setNewItemDiscounts((prev) => ({ ...prev, [key as any]: v }))
          }
          learnInputs={learnInputs}
          updateLearn={updateLearn}
          canSave={canSave}
          showLearnInput={showLearnInput}
          setShowLearnInput={setShowLearnInput}
          onSaveLearn={saveLearnInputs}
          onResetLearn={resetLearnInputs}
          showJson={showJson}
          setShowJson={setShowJson}
          clientItems={clientItems}
          showClientItems={showClientItems}
          loadingClientItems={loadingClientItems}
          onToggleClientItems={() => {
            if (showClientItems) setShowClientItems(false);
            else if (clientItems.length === 0) loadClientItems();
            else setShowClientItems(true);
          }}
          addingItem={addingItem}
          addingQty={addingQty}
          setAddingQty={setAddingQty}
          onStartAdd={addItemManually}
          onConfirmAdd={confirmAddItem}
          onCancelAdd={cancelAddItem}
          onRun={run}
          onClear={clearAll}
          onPasteFromClipboard={pasteFromClipboard}
          onPickClient={pickClient}
          onCopyStaffMessage={copyStaffMessage}
          onApplySuggestion={async (itemIndex, s, price) => {
            applySuggestionToResultUI(itemIndex, s, price);
            await learnSelectedAlias(itemIndex, s, price);
          }}
        />
      )}

      {activeTab === "learning" && (
        <LearningTab
          showLearnedClients={showLearnedClients}
          setShowLearnedClients={setShowLearnedClients}
          learnedClientVersion={learnedClientVersion}
          showLearned={showLearned}
          setShowLearned={setShowLearned}
          learnedVersion={learnedVersion}
          onLearnedVersionBump={() => setLearnedVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
