'use client';

import { useEffect, useRef } from 'react';
import type { LedgerType, SuggestionItem } from '../ledger/types';
import { getInitialDateRange } from '../ledger/lib/quickRanges';
import { usePersistedState } from '@/app/hooks/usePersistedState';
import { useLoadGate } from '@/app/components/ui/LoadGate';
import { computeGrandTotal, groupData } from '../ledger/lib/groupData';
import { printLedger } from '../ledger/lib/printLedger';
import { useClientSearch } from '../ledger/hooks/useClientSearch';
import { useLedgerQuery } from '../ledger/hooks/useLedgerQuery';
import { useLedgerExport } from '../ledger/hooks/useLedgerExport';
import { LedgerFilterCard } from '../ledger/components/LedgerFilterCard';
import { LedgerResultCard } from '../ledger/components/LedgerResultCard';
import { Stack } from '@/app/components/ui';

export default function LedgerTab({
  currentManager: _cm,
  isAdmin: _admin,
}: {
  currentManager: string;
  isAdmin: boolean;
}) {
  const { firstOfMonth, today } = getInitialDateRange();
  // 조회 조건 기억 — 탭/페이지 이동 후 돌아와도 보던 검색 결과 복원 (데이터는 재조회)
  const [startDate, setStartDate] = usePersistedState('ledger:start', firstOfMonth);
  const [endDate, setEndDate] = usePersistedState('ledger:end', today);
  const [type, setType] = usePersistedState<LedgerType>('ledger:type', 'wine');
  const [savedClient, setSavedClient] = usePersistedState<SuggestionItem | null>('ledger:client', null);

  const search = useClientSearch(type, savedClient);
  // 거래처 선택 변화를 저장 (검색 중 해제되면 null 저장)
  useEffect(() => { setSavedClient(search.selectedClient); }, [search.selectedClient, setSavedClient]);
  const query = useLedgerQuery({
    selectedClient: search.selectedClient,
    startDate,
    endDate,
    type,
  });
  const xport = useLedgerExport({
    selectedClient: search.selectedClient,
    client: query.client,
    startDate,
    endDate,
    type,
  });

  const handleTypeChange = (t: LedgerType) => {
    setType(t);
    search.reset();
  };

  // 부팅 커튼 — 복원 자동 재조회 중엔 커튼 유지 (원장 결과까지 한 번에 공개)
  useLoadGate('tab-ledger', query.loading);
  // 복원 직후 1회 자동 재조회 — 보던 결과가 그대로(최신 데이터로) 나타남
  const restoredRef = useRef(!!savedClient);
  useEffect(() => {
    if (restoredRef.current) { restoredRef.current = false; query.handleSearch(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = groupData(query.rows, query.payments);
  const grandTotal = computeGrandTotal(query.rows, query.payments);

  const onPrint = () => {
    if (!query.client) return;
    printLedger({
      client: query.client,
      type,
      startDate,
      endDate,
      rowCount: query.rows.length,
      prevBalance: query.prevBalance,
      grouped,
      grandTotal,
    });
  };

  const hasResult =
    query.client &&
    (query.rows.length > 0 ||
      query.prevBalance !== 0 ||
      query.payments.length > 0);

  return (
    <Stack direction="vertical" gap={16}>
      <LedgerFilterCard
        type={type}
        onTypeChange={handleTypeChange}
        searchRef={search.searchRef}
        clientSearch={search.clientSearch}
        onSearchChange={search.handleSearchChange}
        onSearchFocus={() => {
          if (search.suggestions.length > 0) search.setShowSuggestions(true);
        }}
        selectedClient={search.selectedClient}
        suggestions={search.suggestions}
        showSuggestions={search.showSuggestions}
        onSelectClient={search.selectClient}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        loading={query.loading}
        onSearch={query.handleSearch}
        error={query.error}
      />

      {hasResult && query.client && (
        <LedgerResultCard
          client={query.client}
          startDate={startDate}
          endDate={endDate}
          rowCount={query.rows.length}
          exporting={xport.exporting}
          onExport={xport.handleExport}
          onPrint={onPrint}
          prevBalance={query.prevBalance}
          grouped={grouped}
          collapsedMonths={query.collapsedMonths}
          collapsedDays={query.collapsedDays}
          onToggleMonth={query.toggleMonth}
          onToggleDay={query.toggleDay}
          grandTotal={grandTotal}
        />
      )}

      {query.client &&
        query.rows.length === 0 &&
        query.prevBalance === 0 &&
        query.payments.length === 0 &&
        !query.loading && (
          <EmptyState message="해당 기간에 출고 내역이 없습니다." />
        )}

      {!query.client && !query.loading && (
        <EmptyState>
          거래처를 검색하고 기간을 설정한 후{' '}
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
