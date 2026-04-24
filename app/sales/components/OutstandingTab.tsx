'use client';

import { useState } from 'react';
import type { OutstandingType } from '../outstanding/types';
import { getInitialDates } from '../outstanding/lib/format';
import { useOutstanding } from '../outstanding/hooks/useOutstanding';
import { useBulkExport } from '../outstanding/hooks/useBulkExport';
import { FilterPanel } from '../outstanding/components/FilterPanel';
import { OutstandingTable } from '../outstanding/components/OutstandingTable';
import { ExportButtons } from '../outstanding/components/ExportButtons';
import { exportSummaryExcel } from '../outstanding/lib/summaryExcel';

type Props = { currentManager: string; isAdmin: boolean };

export default function OutstandingTab({ currentManager, isAdmin: _isAdmin }: Props) {
  const { today, firstOfMonth } = getInitialDates();
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<OutstandingType>('wine');

  const list = useOutstanding({ currentManager, startDate, endDate, type });
  const xport = useBulkExport({ checked: list.checked, startDate, endDate, type });
  const [summaryExporting, setSummaryExporting] = useState(false);

  const handleExportSummary = async () => {
    if (list.clients.length === 0) return;
    setSummaryExporting(true);
    try {
      await exportSummaryExcel({
        clients: list.clients,
        totals,
        startDate,
        endDate,
        type,
        manager: currentManager,
      });
    } catch (e) {
      console.error('summary excel export failed', e);
      alert('엑셀 생성에 실패했습니다.');
    } finally {
      setSummaryExporting(false);
    }
  };

  const totals = list.clients.reduce(
    (acc, c) => ({
      prev_balance: acc.prev_balance + c.prev_balance,
      period_supply: acc.period_supply + c.period_supply,
      period_tax: acc.period_tax + c.period_tax,
      period_total: acc.period_total + c.period_total,
      period_payment: acc.period_payment + c.period_payment,
      outstanding: acc.outstanding + c.outstanding,
    }),
    { prev_balance: 0, period_supply: 0, period_tax: 0, period_total: 0, period_payment: 0, outstanding: 0 },
  );

  return (
    <div>
      <FilterPanel
        startDate={startDate}
        endDate={endDate}
        type={type}
        loading={list.loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onTypeChange={setType}
        onSearch={list.fetchData}
      />

      {list.error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(220,38,38,0.04)',
          border: '1.5px solid rgba(220,38,38,0.15)',
          borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 16,
        }}>
          {list.error}
        </div>
      )}

      {list.clients.length > 0 && (
        <>
          <OutstandingTable
            clients={list.clients}
            totals={totals}
            checked={list.checked}
            allChecked={list.allChecked}
            onToggleAll={list.toggleAll}
            onToggleOne={list.toggleOne}
          />
          <ExportButtons
            checkedCount={list.checked.size}
            exporting={xport.exporting}
            onExport={xport.handleExport}
            onExportSummary={handleExportSummary}
            summaryExporting={summaryExporting}
            summaryDisabled={list.clients.length === 0}
          />
        </>
      )}

      {!list.loading && list.clients.length === 0 && !list.error && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a8a098', fontSize: 14 }}>
          해당 담당자의 거래처 미수현황이 없습니다.
        </div>
      )}
    </div>
  );
}
