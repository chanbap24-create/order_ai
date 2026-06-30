"use client";

import { ORDER_COLORS, ORDER_FONT } from "./constants";
import { ActionButtons } from "./components/ActionButtons";
import { ClientHistorySection } from "./components/ClientHistorySection";
import { ClientSearchField } from "./components/ClientSearchField";
import { AutoModeToggle } from "./components/AutoModeToggle";
import { BatchQueue } from "./components/BatchQueue";
import { ErrorBanner } from "./components/ErrorBanner";
import { ImageIntakeButton } from "./components/ImageIntakeButton";
import { ItemListSection } from "./components/ItemListSection";
import {
  OrderLineCard,
  commitPriceText,
  resolveDiscountChange,
} from "./components/OrderLineCard";
import { OrderTextareaSection } from "./components/OrderTextareaSection";
import { OriginalTextCard } from "./components/OriginalTextCard";
import { PageHeader } from "./components/PageHeader";
import { ParseStats } from "./components/ParseStats";
import { PageStyles } from "./components/PageStyles";
import { StaffMessageCard } from "./components/StaffMessageCard";
import { SummaryHeaderCard } from "./components/SummaryHeaderCard";
import { TabSelector } from "./components/TabSelector";
import { TokenUsage } from "./components/TokenUsage";
import { useOrderV2Page } from "./hooks/useOrderV2Page";
import { calcTotalAmount } from "./lib/priceCalc";

export default function OrderV2Page() {
  const g = useOrderV2Page();
  const {
    tab,
    client,
    history,
    delivery,
    parse,
    editor,
    wineSearch,
    orderText,
    setOrderText,
    orderTextRef,
    autoPaste,
    copied,
    deliveryNotes,
    setDeliveryNotes,
    showDeliveryDate,
    setShowDeliveryDate,
    showDeliveryNotes,
    setShowDeliveryNotes,
  } = g;

  const totalAmount = calcTotalAmount(parse.orderLines, editor.discountRates);
  const headerTitle = client.selected?.client_name || client.query || "발주";

  return (
    <>
      <PageStyles />

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "64px 20px 48px",
          fontFamily: ORDER_FONT.base,
          minHeight: "100vh",
        }}
      >
        <PageHeader />

        <div
          className="order-card"
          style={{
            background: ORDER_COLORS.surface,
            borderRadius: 14,
            padding: "22px 22px 20px",
            border: "1px solid var(--action-muted)",
            boxShadow: "0 2px 12px rgba(90,21,21,0.03)",
            marginBottom: 20,
            transition: "box-shadow 0.3s ease",
          }}
        >
          <TabSelector value={tab} onChange={g.setTab} />

          <AutoModeToggle
            on={g.autoMode}
            onToggle={g.toggleAutoMode}
            autoResult={g.autoResult}
          />

          <ImageIntakeButton
            loading={g.imageIntake.loading || g.batch.processing || g.autoBusy}
            error={g.imageIntake.error}
            onFiles={g.handleFiles}
            onClearError={g.imageIntake.clearError}
          />

          <ClientSearchField
            query={client.query}
            setQuery={client.setQuery}
            results={client.results}
            selected={client.selected}
            setSelected={client.setSelected}
            showDropdown={client.showDropdown}
            setShowDropdown={client.setShowDropdown}
            onPick={client.pick}
            dropdownRef={client.dropdownRef}
          />

          {client.selected && (
            <ClientHistorySection
              tab={tab}
              items={history.items}
              loading={history.loading}
              loaded={history.loaded}
              show={history.show}
              showOld={history.showOld}
              setShowOld={history.setShowOld}
              toggle={history.toggle}
              onPickItem={g.addLineFromHistory}
            />
          )}

          <OrderTextareaSection
            textRef={orderTextRef}
            value={orderText}
            onChange={setOrderText}
            autoPaste={autoPaste.autoPaste}
            toggleAutoPaste={autoPaste.toggle}
          />

          <ActionButtons
            loading={parse.loading}
            orderTextTrim={!!orderText.trim()}
            hasResults={parse.orderLines.length > 0}
            onPaste={g.pasteFromClipboard}
            onParse={g.handleParse}
            onReset={g.handleReset}
          />
        </div>

        <ErrorBanner error={parse.error} />

        <BatchQueue
          orders={g.batch.orders}
          processing={g.batch.processing}
          tab={tab}
          onSelectCandidate={g.batch.selectCandidate}
          onSetQty={g.batch.setQuantity}
          onSetClient={g.batch.setClient}
          onRemove={g.batch.removeOrder}
          onClear={g.batch.clear}
        />

        {parse.orderLines.length > 0 && (
          <div style={{ animation: "orderSlideIn 0.3s ease" }}>
            <SummaryHeaderCard
              tab={tab}
              headerTitle={headerTitle}
              orderLines={parse.orderLines}
              totalAmount={totalAmount}
              showDeliveryDate={showDeliveryDate}
              setShowDeliveryDate={setShowDeliveryDate}
              deliveryInfo={delivery.info}
              fridayChoice={delivery.fridayChoice}
              setFridayChoice={delivery.setFridayChoice}
              customDate={delivery.customDate}
              setCustomDate={delivery.setCustomDate}
              finalDeliveryLabel={delivery.finalLabel}
              showDeliveryNotes={showDeliveryNotes}
              setShowDeliveryNotes={setShowDeliveryNotes}
              deliveryNotes={deliveryNotes}
              setDeliveryNotes={setDeliveryNotes}
            />

            <div className="order-compare-grid" style={{ marginBottom: 16 }}>
              <OriginalTextCard orderText={orderText} />
              <StaffMessageCard
                staffMessage={g.staffMessage}
                copied={copied}
                onCopy={g.copyMessage}
              />
            </div>

            {/* 거래처에 보낼 카톡 문구 (인사 + 배송예정일 + 품목/수량/가용재고) */}
            <StaffMessageCard
              title="거래처 전달 메시지"
              staffMessage={g.clientMessage}
              copied={g.clientCopied}
              onCopy={g.copyClientMessage}
            />

            <ItemListSection count={parse.orderLines.length}>
              {parse.orderLines.map((ol, lineIdx) => {
                const isExpanded = editor.expandedLines.has(lineIdx);
                const isSearching = wineSearch.idx === lineIdx;
                const discount = editor.discountRates[lineIdx] || 0;

                return (
                  <OrderLineCard
                    key={lineIdx}
                    line={ol}
                    lineIdx={lineIdx}
                    tab={tab}
                    historySet={parse.historySet}
                    isExpanded={isExpanded}
                    toggleExpand={() => editor.toggleExpand(lineIdx)}
                    // qty
                    editingQty={editor.editingQty[lineIdx]}
                    onEditQty={(v) =>
                      editor.setEditingQty((p) => ({ ...p, [lineIdx]: v }))
                    }
                    onCommitQty={() => {
                      const val = editor.editingQty[lineIdx];
                      if (val === undefined) return;
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 1) g.updateQty(lineIdx, num);
                      editor.setEditingQty((p) => {
                        const n = { ...p };
                        delete n[lineIdx];
                        return n;
                      });
                    }}
                    onDecQty={() => g.updateQty(lineIdx, ol.quantity - 1)}
                    onIncQty={() => g.updateQty(lineIdx, ol.quantity + 1)}
                    onRemoveLine={() => g.removeLine(lineIdx)}
                    // candidates
                    onSelectCandidate={(cIdx) => g.selectCandidate(lineIdx, cIdx)}
                    // manual search
                    isSearching={isSearching}
                    searchQuery={wineSearch.query}
                    setSearchQuery={wineSearch.setQuery}
                    searchResults={wineSearch.results}
                    searchLoading={wineSearch.loading}
                    searchRef={wineSearch.ref}
                    onOpenSearch={() => {
                      wineSearch.setIdx(lineIdx);
                      wineSearch.setQuery("");
                    }}
                    onPickSearch={(wine) => g.replaceWithSearch(lineIdx, wine)}
                    // price / discount
                    discount={discount}
                    editingPrice={editor.editingPrice[lineIdx]}
                    onEditPrice={(v) =>
                      editor.setEditingPrice((p) => ({ ...p, [lineIdx]: v }))
                    }
                    onCommitPrice={() => {
                      const val = editor.editingPrice[lineIdx];
                      const num = commitPriceText(val);
                      if (num !== null) g.updatePrice(lineIdx, num);
                      editor.setEditingPrice((p) => {
                        const n = { ...p };
                        delete n[lineIdx];
                        return n;
                      });
                    }}
                    customDiscountInput={editor.customDiscountInput[lineIdx]}
                    onDiscountSelectChange={(v) => {
                      const change = resolveDiscountChange(v);
                      if (change.type === "custom") {
                        editor.setCustomDiscountInput((p) => ({
                          ...p,
                          [lineIdx]:
                            discount > 0 && discount < 100 ? String(discount) : "",
                        }));
                      } else if (change.type === "tasting") {
                        editor.setCustomDiscountInput((p) => {
                          const n = { ...p };
                          delete n[lineIdx];
                          return n;
                        });
                        editor.setDiscount(lineIdx, 100);
                      } else {
                        editor.setCustomDiscountInput((p) => {
                          const n = { ...p };
                          delete n[lineIdx];
                          return n;
                        });
                        editor.setDiscount(lineIdx, change.value);
                      }
                    }}
                    onCustomDiscountChange={(raw) =>
                      editor.setCustomDiscountInput((p) => ({ ...p, [lineIdx]: raw }))
                    }
                    onCustomDiscountBlur={() => {
                      const num = parseInt(editor.customDiscountInput[lineIdx] || "0", 10);
                      const clamped = Math.min(Math.max(num, 0), 99);
                      editor.setDiscount(lineIdx, clamped);
                      editor.setCustomDiscountInput((p) => {
                        const n = { ...p };
                        delete n[lineIdx];
                        return n;
                      });
                    }}
                  />
                );
              })}
            </ItemListSection>

            <TokenUsage usage={parse.usage} model={parse.model} />
          </div>
        )}
        <ParseStats />
      </div>
    </>
  );
}
