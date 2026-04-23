"use client";

import type {
  InventoryItem,
  InvColumnKey,
  WarehouseTab,
} from "../types";
import type { useInventorySearch } from "../hooks/useInventorySearch";
import type { useImportSchedule } from "../hooks/useImportSchedule";
import type { useTastingNoteModal } from "../hooks/useTastingNoteModal";
import { InvColumnSettings } from "./InvColumnSettings";
import { SearchBar } from "./SearchBar";
import { AdvancedFilterPanel } from "./AdvancedFilterPanel";
import { FilterChips, ErrorBanner } from "./FilterChips";
import { SearchResultsGrid } from "./SearchResultsGrid";

type InvColumnConfig = {
  key: InvColumnKey;
  label: string;
  cdvOnly?: boolean;
  dlOnly?: boolean;
};

type Props = {
  activeTab: WarehouseTab;
  showInvColumnSettings: boolean;
  availableInvColumns: InvColumnConfig[];
  visibleInvColumns: InvColumnKey[];
  toggleInvColumn: (key: InvColumnKey) => void;

  search: ReturnType<typeof useInventorySearch>;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  countryList: string[];
  showAdvancedFilter: boolean;
  setShowAdvancedFilter: (v: boolean) => void;

  tastingModal: ReturnType<typeof useTastingNoteModal>;
  importSchedule: ReturnType<typeof useImportSchedule>;
  addedItemNo: string | null;
  onAddToQuote: (inv: InventoryItem) => Promise<void> | void;
  renderCellValue: (item: InventoryItem, key: InvColumnKey) => any;
};

export function InventorySearchPanel(p: Props) {
  return (
    <>
      {p.showInvColumnSettings && (
        <InvColumnSettings
          availableColumns={p.availableInvColumns}
          visibleColumns={p.visibleInvColumns}
          onToggle={p.toggleInvColumn}
        />
      )}

      <SearchBar
        value={p.search.searchQuery}
        onChange={p.search.setSearchQuery}
        focused={p.searchFocused}
        setFocused={p.setSearchFocused}
        isSearching={p.search.isSearching}
        activeFilterCount={p.search.activeFilterCount}
        showAdvancedFilter={p.showAdvancedFilter}
        onToggleAdvanced={() => p.setShowAdvancedFilter(!p.showAdvancedFilter)}
        onSearch={p.search.handleSearch}
      />

      {p.showAdvancedFilter && (
        <AdvancedFilterPanel
          filters={p.search.advancedFilters as any}
          setFilters={(updater) => p.search.setAdvancedFilters(updater as any)}
          activeCount={p.search.activeFilterCount}
          countryList={p.countryList}
          onApply={p.search.handleSearch}
          onClose={() => p.setShowAdvancedFilter(false)}
        />
      )}

      <ErrorBanner error={p.search.error} />

      <FilterChips
        activeTab={p.activeTab}
        hasSearched={p.search.hasSearched}
        filteredCount={p.search.filteredResults.length}
        hideNoSupplyPrice={p.search.hideNoSupplyPrice}
        setHideNoSupplyPrice={p.search.setHideNoSupplyPrice}
        hideNoStock={p.search.hideNoStock}
        setHideNoStock={p.search.setHideNoStock}
        showOnlyBondedStock={p.search.showOnlyBondedStock}
        setShowOnlyBondedStock={p.search.setShowOnlyBondedStock}
      />

      {p.search.hasSearched && (
        <SearchResultsGrid
          items={p.search.filteredResults}
          allResultsCount={p.search.results.length}
          activeTab={p.activeTab}
          visibleInvColumns={p.visibleInvColumns}
          availableInvColumns={p.availableInvColumns}
          tastingNotesAvailable={p.tastingModal.tastingNotesAvailable}
          importScheduleMap={p.importSchedule.importScheduleMap}
          showImportPopup={p.importSchedule.showImportPopup}
          addedItemNo={p.addedItemNo}
          onTastingNoteClick={p.tastingModal.openFor}
          onToggleImportPopup={p.importSchedule.setShowImportPopup}
          onAddToQuote={p.onAddToQuote}
          renderCellValue={p.renderCellValue}
        />
      )}
    </>
  );
}
