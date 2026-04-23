"use client";

import type { LearnRow, ParseItem, Suggestion } from "../types";
import type { QuickDeliveryDate } from "../lib/deliveryDates";
import { BusinessAndOptionsCard } from "./BusinessAndOptionsCard";
import { ClientItemsPanel } from "./ClientItemsPanel";
import { ClientPickerPanel } from "./ClientPickerPanel";
import { ErrorBanners } from "./ErrorBanners";
import { ItemsResultSection } from "./ItemsResultSection";
import { JsonViewer } from "./JsonViewer";
import { LearnInputCard } from "./LearnInputCard";
import { OrderInputCard } from "./OrderInputCard";
import { OrderSummaryCard } from "./OrderSummaryCard";
import { StaffMessageCard } from "./StaffMessageCard";

export type OrderTabProps = {
  // input
  text: string;
  setText: (v: string) => void;
  clientInput: string;
  setClientInput: (v: string) => void;
  loading: boolean;
  autoPaste: boolean;
  setAutoPaste: (v: boolean) => void;
  hasClipboard: boolean;
  data: any;
  copied: boolean;
  // 신규 사업자 / 옵션
  newBusinessProps: React.ComponentProps<typeof BusinessAndOptionsCard>["newBusiness"];
  orderOptionsProps: Omit<
    React.ComponentProps<typeof BusinessAndOptionsCard>["orderOptions"],
    "quickDeliveryDates"
  >;
  quickDeliveryDates: QuickDeliveryDate[];
  // 거래처 후보
  needsClientPick: boolean;
  clientCandidates: any[] | null;
  hintUsed: string;
  pendingOrderText: string;
  // 결과
  showItemsPanel: boolean;
  setShowItemsPanel: (fn: (v: boolean) => boolean) => void;
  showMoreSuggestions: Record<number, boolean>;
  toggleShowMore: (idx: number) => void;
  savingPick: Record<number, boolean>;
  savedPick: Record<number, boolean>;
  newItemPrices: Record<string, string>;
  newItemDiscounts: Record<string, number>;
  onPriceChange: (key: string, v: string) => void;
  onDiscountChange: (key: string, v: number) => void;
  // 학습 입력
  learnInputs: LearnRow[];
  updateLearn: (i: number, key: keyof LearnRow, value: string) => void;
  canSave: boolean;
  showLearnInput: boolean;
  setShowLearnInput: (fn: (v: boolean) => boolean) => void;
  onSaveLearn: () => Promise<boolean> | void;
  onResetLearn: () => void;
  // JSON
  showJson: boolean;
  setShowJson: (fn: (v: boolean) => boolean) => void;
  // 거래처 품목
  clientItems: any[];
  showClientItems: boolean;
  loadingClientItems: boolean;
  onToggleClientItems: () => void;
  addingItem: any;
  addingQty: string;
  setAddingQty: (v: string) => void;
  onStartAdd: (item: any) => void;
  onConfirmAdd: () => void;
  onCancelAdd: () => void;
  // actions
  onRun: () => void;
  onClear: () => void;
  onPasteFromClipboard: () => Promise<void>;
  onPickClient: (c: any) => void;
  onCopyStaffMessage: () => void;
  onApplySuggestion: (itemIndex: number, s: Suggestion, price?: string) => void | Promise<void>;
};

/** Wine 발주 입력 탭 전체 조립 */
export function OrderTab(p: OrderTabProps) {
  return (
    <>
      <OrderInputCard
        clientInput={p.clientInput}
        setClientInput={p.setClientInput}
        text={p.text}
        setText={p.setText}
        loading={p.loading}
        autoPaste={p.autoPaste}
        setAutoPaste={p.setAutoPaste}
        hasClipboard={p.hasClipboard}
        data={p.data}
        onRun={p.onRun}
        onClear={p.onClear}
        onPasteFromClipboard={p.onPasteFromClipboard}
      />

      <BusinessAndOptionsCard
        newBusiness={p.newBusinessProps}
        orderOptions={{ ...p.orderOptionsProps, quickDeliveryDates: p.quickDeliveryDates }}
      />

      <ErrorBanners data={p.data} needsClientPick={p.needsClientPick} />

      {p.data && p.needsClientPick && (
        <ClientPickerPanel
          candidates={p.clientCandidates ?? []}
          loading={p.loading}
          hintUsed={p.hintUsed}
          pendingOrderText={p.pendingOrderText}
          onPick={p.onPickClient}
        />
      )}

      {p.data && !p.needsClientPick && (
        <div style={{ marginTop: 16 }}>
          <StaffMessageCard
            staffMessage={String(p.data.staff_message ?? "")}
            status={p.data?.status}
            copied={p.copied}
            onCopy={p.onCopyStaffMessage}
          />
          <OrderSummaryCard
            clientName={String(p.data?.client?.client_name ?? "")}
            clientCode={String(p.data?.client?.client_code ?? "")}
            parsedItems={Array.isArray(p.data?.parsed_items) ? p.data.parsed_items : []}
          />
          <ItemsResultSection
            items={(Array.isArray(p.data?.items) ? p.data.items : []) as ParseItem[]}
            open={p.showItemsPanel}
            toggleOpen={() => p.setShowItemsPanel((v) => !v)}
            showMoreSuggestions={p.showMoreSuggestions}
            toggleShowMore={p.toggleShowMore}
            savingPick={p.savingPick}
            savedPick={p.savedPick}
            newItemPrices={p.newItemPrices}
            newItemDiscounts={p.newItemDiscounts}
            onPriceChange={p.onPriceChange}
            onDiscountChange={p.onDiscountChange}
            onApply={p.onApplySuggestion}
          />
          <LearnInputCard
            open={p.showLearnInput}
            toggleOpen={() => p.setShowLearnInput((v) => !v)}
            rows={p.learnInputs}
            setField={p.updateLearn}
            onSave={p.onSaveLearn}
            onReset={p.onResetLearn}
            canSave={p.canSave}
          />
          <JsonViewer
            data={p.data}
            open={p.showJson}
            toggleOpen={() => p.setShowJson((v) => !v)}
          />
        </div>
      )}

      {p.data?.client?.status === "resolved" && p.data?.client?.client_code && (
        <ClientItemsPanel
          clientName={p.data.client.client_name}
          items={p.clientItems}
          show={p.showClientItems}
          loading={p.loadingClientItems}
          onToggle={p.onToggleClientItems}
          addingItem={p.addingItem}
          addingQty={p.addingQty}
          setAddingQty={p.setAddingQty}
          onStartAdd={p.onStartAdd}
          onConfirmAdd={p.onConfirmAdd}
          onCancelAdd={p.onCancelAdd}
        />
      )}
    </>
  );
}
