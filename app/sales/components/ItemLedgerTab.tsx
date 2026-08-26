'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchItem, ViewMode, Warehouse } from '../item-ledger/types';
import { getInitialRange } from '../item-ledger/lib/quickRanges';
import { usePersistedState } from '@/app/hooks/usePersistedState';
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
  // 조회 조건 기억 — 탭/페이지 이동 후 돌아와도 보던 결과 복원 (데이터는 재조회)
  const [startDate, setStartDate] = usePersistedState('item-ledger:start', yearStart);
  const [endDate, setEndDate] = usePersistedState('item-ledger:end', today);
  const [warehouse, setWarehouse] = usePersistedState<Warehouse>('item-ledger:wh', 'CDV');
  const [viewMode, setViewMode] = useState<ViewMode>('date');
  const [savedItem, setSavedItem] = usePersistedState<SearchItem | null>('item-ledger:item', null);

  const search = useItemSearch(warehouse, savedItem);
  useEffect(() => { setSavedItem(search.selectedItem); }, [search.selectedItem, setSavedItem]);
  const ledger = useItemLedger({
    selectedItem: search.selectedItem,
    startDate,
    endDate,
    warehouse,
  });

  // 복원 직후 1회 자동 재조회
  const restoredRef = useRef(!!savedItem);
  useEffect(() => {
    if (restoredRef.current) { restoredRef.current = false; ledger.handleSearch(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
