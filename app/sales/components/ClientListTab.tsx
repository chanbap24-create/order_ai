'use client';

import { useState } from 'react';
import { useClientList } from '../client-list/hooks/useClientList';
import { useBatchRecommend } from '../client-list/hooks/useBatchRecommend';
import { FilterPanel } from '../client-list/components/FilterPanel';
import { SummaryCards } from '../client-list/components/SummaryCards';
import { ClientsTable } from '../client-list/components/ClientsTable';
import { DormantView, type DormantClient } from '../client-list/components/DormantView';
import { BatchRecommendBar } from '../client-list/components/BatchRecommendBar';
import { ClientDetailPanel } from '../analysis/components/ClientDetailPanel';
import type { SelectedRankClient, AnalysisFilters } from '../analysis/types';
import { Stack } from '@/app/components/ui';

export default function ClientListTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const s = useClientList({ currentManager, isAdmin });
  const [selected, setSelected] = useState<{ client: SelectedRankClient; filters: AnalysisFilters } | null>(null);
  // 추천견적 일괄 생성: 까브드뱅(CDV/wine)에서만 — 추천엔진이 CDV 재고 기반.
  const batchable = s.type === 'wine';
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const batch = useBatchRecommend(currentManager);

  // 거래처명·코드 검색 (클라이언트 필터)
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const shownClients = q
    ? s.clients.filter(
        (c) =>
          (c.client_name || '').toLowerCase().includes(q) ||
          (c.client_code || '').toLowerCase().includes(q),
      )
    : s.clients;

  // 휴면·이탈위험 뷰 (윈백) — 본인 발주주기 기준 자동 발굴
  const [view, setView] = useState<'all' | 'dormant'>('all');
  const [dormantList, setDormantList] = useState<DormantClient[]>([]);
  const dormantManager = s.managerFilter && s.managerFilter !== '전체' ? s.managerFilter : currentManager;

  const selectableClients = shownClients.filter((c) => c.client_code);
  const allSelected = selectableClients.length > 0 && selectableClients.every((c) => picked.has(c.client_code));
  const togglePick = (code: string) =>
    setPicked((prev) => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const toggleAll = () =>
    setPicked(() => (allSelected ? new Set() : new Set(selectableClients.map((c) => c.client_code))));
  const runBatch = () => {
    const source = view === 'dormant' ? dormantList : s.clients;
    const targets = source
      .filter((c) => picked.has(c.client_code))
      .map((c) => ({ client_code: c.client_code, client_name: c.client_name }));
    void batch.run(targets, { winback: view === 'dormant' });
  };

  if (selected) {
    return (
      <ClientDetailPanel
        client={selected.client}
        currentManager={currentManager}
        isAdmin={isAdmin}
        filters={selected.filters}
        onBack={() => setSelected(null)}
        onVenueChange={s.updateVenue}
      />
    );
  }

  return (
    <Stack direction="vertical" gap={16}>
      <FilterPanel
        isAdmin={isAdmin}
        managerList={s.managerList}
        managerFilter={s.managerFilter}
        onManagerChange={s.setManagerFilter}
        type={s.type}
        onTypeChange={(t) => { s.setType(t); s.setBusinessType(''); }}
        preset={s.preset}
        onPresetChange={s.setPreset}
        startDate={s.startDate}
        endDate={s.endDate}
        onStartDateChange={s.setStartDate}
        onEndDateChange={s.setEndDate}
        businessType={s.businessType}
        onBusinessTypeChange={s.setBusinessType}
        businessTypes={s.businessTypes}
      />

      <SummaryCards
        totalClients={s.totalClients}
        totalSupply={s.totalSupply}
        totalAmount={s.totalAmount}
      />

      {/* 거래처 검색 + 휴면 뷰 전환 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="거래처명 또는 코드 검색"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--border-default)', fontSize: 14,
            background: '#fff', color: 'var(--text-primary)', outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
        />
        {batchable && (
          <button
            onClick={() => { setView((v) => (v === 'dormant' ? 'all' : 'dormant')); setPicked(new Set()); }}
            style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              border: `1px solid ${view === 'dormant' ? 'var(--action)' : 'var(--border-default)'}`,
              background: view === 'dormant' ? 'var(--action)' : '#fff',
              color: view === 'dormant' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="발주주기 기준 휴면·이탈위험 거래처 자동 발굴 — 선택해서 윈백 견적 일괄 생성"
          >
            {view === 'dormant' ? '← 전체 거래처' : '휴면·이탈위험'}
          </button>
        )}
      </div>

      {batchable && (
        <BatchRecommendBar
          count={picked.size}
          running={batch.running}
          progress={batch.progress}
          message={batch.message}
          onRun={runBatch}
          onClear={() => setPicked(new Set())}
        />
      )}

      {view === 'dormant' ? (
        <DormantView
          manager={dormantManager}
          picked={picked}
          onTogglePick={togglePick}
          onPickAll={(codes) => setPicked(new Set(codes))}
          onLoaded={setDormantList}
        />
      ) : (
      <ClientsTable
        clients={shownClients}
        loading={s.loading}
        sortKey={s.sortKey}
        onSort={s.handleSort}
        sortIcon={s.sortIcon}
        selectable={batchable}
        selectedCodes={picked}
        onToggleSelect={togglePick}
        onToggleAll={toggleAll}
        allSelected={allSelected}
        onRowClick={(c) =>
          setSelected({
            client: {
              client_code: c.client_code,
              client_name: c.client_name,
              importance: 3,
              manager: s.managerFilter && s.managerFilter !== '전체' ? s.managerFilter : null,
              business_type: c.business_type || null,
              client_type: s.type,
            },
            filters: { type: s.type, startDate: s.startDate, endDate: s.endDate, manager: s.managerFilter },
          })
        }
      />
      )}

      {view === 'all' && !s.loading && s.clients.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          {s.startDate} ~ {s.endDate} · {s.managerFilter} · {s.businessType || '전체 업종'} · {s.type === 'wine' ? '까브드뱅' : '대유라이프'}
        </div>
      )}
    </Stack>
  );
}
