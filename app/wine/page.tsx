"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildQuickDeliveryDates } from "./lib/deliveryDates";
import { LoadGateProvider } from "@/app/components/ui/LoadGate";
import { LearningTab } from "./components/LearningTab";
import { OrderTab } from "./components/OrderTab";
import { createWineOrderHandlers } from "./hooks/useWineOrderHandlers";
import { useAddItem } from "./hooks/useAddItem";
import { useClientItems } from "./hooks/useClientItems";
import { useClipboard } from "./hooks/useClipboard";
import { useLearnInputs } from "./hooks/useLearnInputs";
import { useNewBusiness } from "./hooks/useNewBusiness";
import { useOrderAutoEffects } from "./hooks/useOrderAutoEffects";
import { useOrderOptions } from "./hooks/useOrderOptions";

export default function Home({ subTab }: { subTab?: "order" | "learning" }) {
  // 부팅 커튼 — 페이지가 조각조각 뜨지 않고 한 번에 공개
  return (
    <LoadGateProvider>
      <HomeBody subTab={subTab} />
    </LoadGateProvider>
  );
}

function HomeBody({ subTab }: { subTab?: "order" | "learning" }) {
  const [text, setText] = useState("");
  const [clientInput, setClientInput] = useState("");
  const [force, setForce] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"order" | "learning">("order");
  useEffect(() => {
    if (subTab) setActiveTab(subTab);
  }, [subTab]);

  const [clientCandidates, setClientCandidates] = useState<any[] | null>(null);
  const [pendingOrderText, setPendingOrderText] = useState<string>("");
  const [pendingPreMessage, setPendingPreMessage] = useState<string>("");

  const [showLearned, setShowLearned] = useState(false);
  const [learnedVersion, setLearnedVersion] = useState(0);

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

  const [copied, setCopied] = useState(false);
  const onInitialPaste = useCallback((clip: string) => setText(clip), []);
  const { autoPaste, setAutoPaste, hasClipboard } = useClipboard(onInitialPaste);

  const [showJson, setShowJson] = useState(false);
  const [savingPick, setSavingPick] = useState<Record<number, boolean>>({});
  const [savedPick, setSavedPick] = useState<Record<number, boolean>>({});
  const [newItemPrices, setNewItemPrices] = useState<Record<string, string>>({});
  const [newItemDiscounts, setNewItemDiscounts] = useState<Record<string, number>>({});
  const [showMoreSuggestions, setShowMoreSuggestions] = useState<Record<number, boolean>>({});
  const [showItemsPanel, setShowItemsPanel] = useState(false);
  const [showLearnInput, setShowLearnInput] = useState(false);

  const {
    items: clientItems,
    show: showClientItems,
    setShow: setShowClientItems,
    loading: loadingClientItems,
    load: loadClientItemsFromCode,
  } = useClientItems();
  const loadClientItems = () => loadClientItemsFromCode(data?.client?.client_code);

  const [showLearnedClients, setShowLearnedClients] = useState(false);
  const [learnedClientVersion, setLearnedClientVersion] = useState(0);
  const [showLearnedNewItems, setShowLearnedNewItems] = useState(false);

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

  const {
    target: addingItem,
    qty: addingQty,
    setQty: setAddingQty,
    start: addItemManually,
    cancel: cancelAddItem,
    confirm: confirmAddItem,
  } = useAddItem((line) => setText((prev) => prev + `\n${line}`));

  const quickDeliveryDates = useMemo(() => buildQuickDeliveryDates(), []);

  const {
    run,
    pickClient,
    pasteFromClipboard,
    clearAll,
    copyStaffMessage,
    applySuggestionToResultUI,
    learnSelectedAlias,
  } = createWineOrderHandlers({
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
          newItemDiscounts={newItemDiscounts}
          onPriceChange={(key, v) => setNewItemPrices((prev) => ({ ...prev, [key]: v }))}
          onDiscountChange={(key, v) =>
            setNewItemDiscounts((prev) => ({ ...prev, [key]: v }))
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
          showLearnedNewItems={showLearnedNewItems}
          setShowLearnedNewItems={setShowLearnedNewItems}
          learnedNewItemsVersion={learnedVersion}
        />
      )}
    </div>
  );
}
