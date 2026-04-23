'use client';

import { useState } from 'react';
import type { LedgerType } from '../ledger/types';
import { getInitialDateRange } from '../ledger/lib/quickRanges';
import { computeGrandTotal, groupData } from '../ledger/lib/groupData';
import { printLedger } from '../ledger/lib/printLedger';
import { useClientSearch } from '../ledger/hooks/useClientSearch';
import { useLedgerQuery } from '../ledger/hooks/useLedgerQuery';
import { useLedgerExport } from '../ledger/hooks/useLedgerExport';
import { LedgerFilterCard } from '../ledger/components/LedgerFilterCard';
import { LedgerResultCard } from '../ledger/components/LedgerResultCard';

export default function LedgerTab({ currentManager: _cm, isAdmin: _admin }: { currentManager: string; isAdmin: boolean }) {
  const { firstOfMonth, today } = getInitialDateRange();
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<LedgerType>('wine');

  const search = useClientSearch(type);
  const query = useLedgerQuery({
    selectedClient: search.selectedClient,
    startDate, endDate, type,
  });
  const xport = useLedgerExport({
    selectedClient: search.selectedClient,
    client: query.client,
    startDate, endDate, type,
  });

  const handleTypeChange = (t: LedgerType) => {
    setType(t);
    search.reset();
  };

  const grouped = groupData(query.rows, query.payments);
  const grandTotal = computeGrandTotal(query.rows, query.payments);

  const onPrint = () => {
    if (!query.client) return;
    printLedger({
      client: query.client,
      type, startDate, endDate,
      rowCount: query.rows.length,
      prevBalance: query.prevBalance,
      grouped, grandTotal,
    });
  };

  const hasResult = query.client && (
    query.rows.length > 0 || query.prevBalance !== 0 || query.payments.length > 0
  );

  return (
    <div>
      <LedgerFilterCard
        type={type}
        onTypeChange={handleTypeChange}
        searchRef={search.searchRef}
        clientSearch={search.clientSearch}
        onSearchChange={search.handleSearchChange}
        onSearchFocus={() => { if (search.suggestions.length > 0) search.setShowSuggestions(true); }}
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

      {query.client && query.rows.length === 0 && query.prevBalance === 0 && query.payments.length === 0 && !query.loading && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 14,
          border: '1px solid rgba(90,21,21,0.06)',
        }}>
          해당 기간에 출고 내역이 없습니다.
        </div>
      )}

      {!query.client && !query.loading && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 13,
          border: '1px solid rgba(90,21,21,0.06)',
          lineHeight: 1.8,
        }}>
          거래처를 검색하고 기간을 설정한 후<br/>
          <strong style={{ color: '#5A1515' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}
