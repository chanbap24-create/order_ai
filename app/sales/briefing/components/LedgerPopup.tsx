'use client';

import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useLedgerQuery } from '@/app/sales/ledger/hooks/useLedgerQuery';
import { useLedgerExport } from '@/app/sales/ledger/hooks/useLedgerExport';
import { groupData, computeGrandTotal } from '@/app/sales/ledger/lib/groupData';
import { printLedger } from '@/app/sales/ledger/lib/printLedger';
import { LedgerResultCard } from '@/app/sales/ledger/components/LedgerResultCard';
import type { LedgerType, SuggestionItem } from '@/app/sales/ledger/types';

type Props = {
  clientCode: string;
  clientName: string;
  type: LedgerType;
  startDate: string; // 미결제 출고가 속한 달의 1일
  endDate: string;
  onClose: () => void;
};

// 브리핑에서 거래처 원장을 팝업으로 표시 (기존 원장 컴포넌트 재사용).
export function LedgerPopup({ clientCode, clientName, type, startDate, endDate, onClose }: Props) {
  const selectedClient = useMemo<SuggestionItem>(
    () => ({ code: clientCode, name: clientName, type }), [clientCode, clientName, type],
  );
  const query = useLedgerQuery({ selectedClient, startDate, endDate, type });
  const xport = useLedgerExport({ selectedClient, client: query.client, startDate, endDate, type });

  const { handleSearch } = query;
  useEffect(() => { handleSearch(); }, [handleSearch]);

  const grouped = groupData(query.rows, query.payments);
  const grandTotal = computeGrandTotal(query.rows, query.payments);
  const onPrint = () => {
    if (!query.client) return;
    printLedger({ client: query.client, type, startDate, endDate, rowCount: query.rows.length, prevBalance: query.prevBalance, grouped, grandTotal });
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
            매출처원장 · {clientName} <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 12 }}>{startDate.slice(0, 7)}~</span>
          </span>
          <button onClick={onClose} style={closeBtn} aria-label="닫기">✕</button>
        </div>
        <div style={body}>
          {query.loading && <div style={center}>불러오는 중…</div>}
          {query.error && <div style={{ ...center, color: 'var(--status-danger)' }}>{query.error}</div>}
          {!query.loading && !query.error && query.client && (
            <LedgerResultCard
              client={query.client} startDate={startDate} endDate={endDate}
              rowCount={query.rows.length} exporting={xport.exporting}
              onExport={xport.handleExport} onPrint={onPrint}
              prevBalance={query.prevBalance} grouped={grouped}
              collapsedMonths={query.collapsedMonths} collapsedDays={query.collapsedDays}
              onToggleMonth={query.toggleMonth} onToggleDay={query.toggleDay}
              grandTotal={grandTotal}
            />
          )}
          {!query.loading && !query.error && query.client && query.rows.length === 0 && query.prevBalance === 0 && query.payments.length === 0 && (
            <div style={center}>해당 기간 내역이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modal: CSSProperties = {
  background: 'var(--surface)', borderRadius: 12, width: 'min(960px, 100%)',
  maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
};
const header: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '12px 16px', borderBottom: '1px solid var(--border-default)', flexShrink: 0,
};
const body: CSSProperties = { padding: 16, overflow: 'auto' };
const center: CSSProperties = { padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 };
const closeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-default)',
  background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14,
};
