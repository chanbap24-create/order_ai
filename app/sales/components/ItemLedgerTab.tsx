'use client';

import { useState } from 'react';
import type { ViewMode, Warehouse } from '../item-ledger/types';
import { getInitialRange } from '../item-ledger/lib/quickRanges';
import { useItemSearch } from '../item-ledger/hooks/useItemSearch';
import { useItemLedger } from '../item-ledger/hooks/useItemLedger';
import { FilterCard } from '../item-ledger/components/FilterCard';
import { ResultCard } from '../item-ledger/components/ResultCard';

export default function ItemLedgerTab({
  currentManager: _cm, isAdmin: _admin,
}: { currentManager: string; isAdmin: boolean }) {
  const { yearStart, today } = getInitialRange();
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [warehouse, setWarehouse] = useState<Warehouse>('CDV');
  const [viewMode, setViewMode] = useState<ViewMode>('date');

  const search = useItemSearch(warehouse);
  const ledger = useItemLedger({
    selectedItem: search.selectedItem,
    startDate, endDate, warehouse,
  });

  const handleWarehouseChange = (w: Warehouse) => {
    setWarehouse(w);
    search.reset();
    ledger.clearResults();
  };

  return (
    <div>
      <FilterCard
        warehouse={warehouse}
        onWarehouseChange={handleWarehouseChange}
        searchRef={search.searchRef}
        itemSearch={search.itemSearch}
        onSearchChange={search.handleSearchChange}
        onSearchFocus={() => { if (search.suggestions.length > 0) search.setShowSuggestions(true); }}
        selectedItem={search.selectedItem}
        suggestions={search.suggestions}
        showSuggestions={search.showSuggestions}
        onSelectItem={search.selectItem}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        loading={ledger.loading}
        onSearch={ledger.handleSearch}
        error={ledger.error}
      />

      {ledger.rows.length > 0 && (
        <ResultCard
          itemName={ledger.itemName}
          selectedItem={search.selectedItem}
          totals={ledger.totals}
          rows={ledger.rows}
          clientSummary={ledger.clientSummary}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {search.selectedItem && ledger.rows.length === 0 && !ledger.loading && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 14,
          border: '1px solid rgba(90,21,21,0.06)',
        }}>
          해당 기간에 판매 내역이 없습니다.
        </div>
      )}

      {!search.selectedItem && !ledger.loading && ledger.rows.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 13,
          border: '1px solid rgba(90,21,21,0.06)',
          lineHeight: 1.8,
        }}>
          제품코드 또는 품목명을 검색하고<br/>
          <strong style={{ color: '#5A1515' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}
