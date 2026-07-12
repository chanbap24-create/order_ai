'use client';

import { useState } from 'react';
import type { ViewMode, Warehouse } from '../item-ledger/types';
import { getInitialRange } from '../item-ledger/lib/quickRanges';
import { useItemSearch } from '../item-ledger/hooks/useItemSearch';
import { useItemLedger } from '../item-ledger/hooks/useItemLedger';
import { FilterCard } from '../item-ledger/components/FilterCard';
import { ResultCard } from '../item-ledger/components/ResultCard';
import { Stack } from '@/app/components/ui';

export default function ItemLedgerTab({
  currentManager: _cm,
  isAdmin: _admin,
}: {
  currentManager: string;
  isAdmin: boolean;
}) {
  const { yearStart, today } = getInitialRange();
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [warehouse, setWarehouse] = useState<Warehouse>('CDV');
  const [viewMode, setViewMode] = useState<ViewMode>('date');

  const search = useItemSearch(warehouse);
  const ledger = useItemLedger({
    selectedItem: search.selectedItem,
    startDate,
    endDate,
    warehouse,
  });

  const handleWarehouseChange = (w: Warehouse) => {
    setWarehouse(w);
    search.reset();
    ledger.clearResults();
  };

  return (
    <Stack direction="vertical" gap={16}>
      <FilterCard
        warehouse={warehouse}
        onWarehouseChange={handleWarehouseChange}
        searchRef={search.searchRef}
        itemSearch={search.itemSearch}
        onSearchChange={search.handleSearchChange}
        onSearchFocus={() => {
          if (search.suggestions.length > 0) search.setShowSuggestions(true);
        }}
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
        <EmptyState message="해당 기간에 판매 내역이 없습니다." />
      )}

      {!search.selectedItem && !ledger.loading && ledger.rows.length === 0 && (
        <EmptyState>
          제품코드 또는 품목명을 검색하고{' '}
          <strong style={{ color: 'var(--action)' }}>조회</strong> 버튼을 눌러주세요.
        </EmptyState>
      )}
    </Stack>
  );
}

function EmptyState({
  message,
  children,
}: {
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: '60px 20px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      {message || children}
    </div>
  );
}
