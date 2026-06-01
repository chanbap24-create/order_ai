'use client';

import { useState } from 'react';
import type { OutstandingType } from '../outstanding/types';
import { getInitialDates } from '../outstanding/lib/format';
import { useOutstanding } from '../outstanding/hooks/useOutstanding';
import { useAging } from '../outstanding/hooks/useAging';
import { useBulkExport } from '../outstanding/hooks/useBulkExport';
import { FilterPanel } from '../outstanding/components/FilterPanel';
import { OutstandingTable } from '../outstanding/components/OutstandingTable';
import { AgingSummary } from '../outstanding/components/AgingSummary';
import { AgingTable } from '../outstanding/components/AgingTable';
import { ExportButtons } from '../outstanding/components/ExportButtons';
import { exportSummaryExcel } from '../outstanding/lib/summaryExcel';
import { Stack } from '@/app/components/ui';

type Props = {
  currentManager: string;
  isAdmin: boolean;
  /** isAdmin 인 경우 다른 매니저 미수도 볼 수 있도록 드롭다운에 넣을 매니저 목록 */
  initialManagers?: string[];
};

export default function OutstandingTab({ currentManager, isAdmin, initialManagers }: Props) {
  const { today, firstOfMonth } = getInitialDates();
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<OutstandingType>('wine');
  // isAdmin/sales_admin 일 때 선택한 매니저, 일반 user 는 본인 매니저 그대로.
  const [selectedManager, setSelectedManager] = useState(currentManager);

  const [view, setView] = useState<'balance' | 'aging'>('balance');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const effectiveManager = isAdmin ? selectedManager : currentManager;
  const list = useOutstanding({ currentManager: effectiveManager, startDate, endDate, type });
  const aging = useAging({ currentManager: effectiveManager, type, asOf: endDate, enabled: view === 'aging' });
  const xport = useBulkExport({ checked: list.checked, startDate, endDate, type });
  const [summaryExporting, setSummaryExporting] = useState(false);

  const agingRows = overdueOnly
    ? aging.rows.filter(r => r.b_m2 + r.b_m3 > 0)
    : aging.rows;

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
        manager: effectiveManager,
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
    <Stack direction="vertical" gap={16}>
      <FilterPanel
        startDate={startDate}
        endDate={endDate}
        type={type}
        loading={list.loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onTypeChange={setType}
        onSearch={list.fetchData}
        managers={isAdmin ? initialManagers : undefined}
        selectedManager={selectedManager}
        onManagerChange={setSelectedManager}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          {([['balance', '미수현황'], ['aging', '연령분석']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: view === v ? 'var(--action)' : 'var(--surface)',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'aging' && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
            연체(2개월+)만 보기
          </label>
        )}
      </div>

      {view === 'aging' && (
        <>
          {aging.error && <ErrorBox msg={aging.error} />}
          {aging.loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>}
          {!aging.loading && agingRows.length > 0 && (
            <>
              <AgingSummary rows={agingRows} recentPaymentTotal={aging.recentPaymentTotal} />
              <AgingTable rows={agingRows} asOf={endDate} onSaveFollowup={aging.saveFollowup} />
            </>
          )}
          {!aging.loading && agingRows.length === 0 && !aging.error && (
            <EmptyBox msg={overdueOnly ? '연체(2개월+) 거래처가 없습니다.' : '해당 담당자의 미수 거래처가 없습니다.'} />
          )}
        </>
      )}

      {view === 'balance' && list.error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(220,38,38,0.04)',
            border: '1px solid rgba(220,38,38,0.18)',
            borderRadius: 8,
            fontSize: 13,
            color: '#dc2626',
          }}
        >
          {list.error}
        </div>
      )}

      {view === 'balance' && list.clients.length > 0 && (
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

      {view === 'balance' && !list.loading && list.clients.length === 0 && !list.error && (
        <EmptyBox msg="해당 담당자의 거래처 미수현황이 없습니다." />
      )}
    </Stack>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: '10px 14px', background: 'rgba(220,38,38,0.04)',
      border: '1px solid rgba(220,38,38,0.18)', borderRadius: 8, fontSize: 13, color: '#dc2626',
    }}>
      {msg}
    </div>
  );
}

function EmptyBox({ msg }: { msg: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 13,
      background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10,
    }}>
      {msg}
    </div>
  );
}
