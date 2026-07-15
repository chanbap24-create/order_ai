'use client';

import { useEffect, useState } from 'react';
import { useClientList } from '../client-list/hooks/useClientList';
import { useBatchRecommend } from '../client-list/hooks/useBatchRecommend';
import { useClientGroups, type ClientGroup } from '../client-list/hooks/useClientGroups';
import { useQuoteCols } from '../recommend/hooks/useQuoteCols';
import { FilterPanel } from '../client-list/components/FilterPanel';
import { SummaryCards } from '../client-list/components/SummaryCards';
import { ClientsTable } from '../client-list/components/ClientsTable';
import { BatchRecommendBar } from '../client-list/components/BatchRecommendBar';
import { ClientGroupBar } from '../client-list/components/ClientGroupBar';
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
  const cols = useQuoteCols(); // 견적서 컬럼(계정별 서버 저장) — 일괄 생성 전 조정 가능

  // 윈백 배지 — 발주 리듬 끊긴 거래처(추천견적에 윈백가 자동 적용) 한눈에 표기. 목록과 별개로 비동기 로드.
  const [winbackMap, setWinbackMap] = useState<Record<string, 'dormant' | 'risk'>>({});
  useEffect(() => {
    if (s.type !== 'wine' || s.clients.length === 0) return;
    const codes = s.clients.map((c) => c.client_code).filter(Boolean);
    if (codes.length === 0) return;
    let alive = true;
    fetch('/api/sales/clients/winback-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes }),
    })
      .then((r) => r.json())
      .then((j) => { if (alive) setWinbackMap(j.statuses || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [s.type, s.clients]);

  // 거래처 그룹(즐겨찾기) — 견적 보낼 거래처 묶음. 그룹 선택 시 구성원 자동 체크 + 목록 필터.
  const grp = useClientGroups(s.type);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const activeGroup = grp.groups.find((g) => g.id === activeGroupId) || null;
  const pickGroup = (g: ClientGroup) => {
    setActiveGroupId(g.id);
    setPicked(new Set(g.clients.map((c) => c.code)));
  };
  const clearGroup = () => { setActiveGroupId(null); setPicked(new Set()); };
  const pickedAsGroupClients = () => {
    // 체크된 거래처의 이름: 현재 목록 → 활성 그룹 → 코드 순으로 확보
    const nameOf = new Map<string, string>();
    for (const c of s.clients) if (c.client_code) nameOf.set(c.client_code, c.client_name);
    for (const g of grp.groups) for (const c of g.clients) if (!nameOf.has(c.code)) nameOf.set(c.code, c.name);
    return [...picked].map((code) => ({ code, name: nameOf.get(code) || code }));
  };
  const saveNewGroup = async () => {
    const name = window.prompt('새 그룹 이름'); if (!name?.trim()) return;
    const g = await grp.create(name.trim(), pickedAsGroupClients());
    if (g) setActiveGroupId(g.id);
  };
  const addToGroup = async (id: number) => {
    // 체크된 거래처를 그룹에 합집합으로 추가(기존 구성원 유지, 코드 중복 제거)
    const g = grp.groups.find((x) => x.id === id);
    if (!g || picked.size === 0) return;
    const merged = new Map<string, { code: string; name: string }>();
    for (const c of g.clients) merged.set(c.code, c);
    for (const c of pickedAsGroupClients()) if (!merged.has(c.code)) merged.set(c.code, c);
    await grp.update(id, { clients: [...merged.values()] });
  };
  const removeFromActiveGroup = async () => {
    // 체크된 거래처를 활성 그룹에서 제거(그룹 자체·거래처 데이터는 유지)
    if (!activeGroup || picked.size === 0) return;
    const remaining = activeGroup.clients.filter((c) => !picked.has(c.code));
    const removedCount = activeGroup.clients.length - remaining.length;
    if (removedCount === 0) return;
    if (!window.confirm(`'${activeGroup.name}'에서 ${removedCount}곳을 제거할까요?`)) return;
    await grp.update(activeGroup.id, { clients: remaining });
    setPicked(new Set(remaining.map((c) => c.code)));
  };
  const updateActiveGroup = async () => {
    if (!activeGroup) return;
    if (!window.confirm(`'${activeGroup.name}' 구성원을 현재 체크된 ${picked.size}곳으로 교체할까요?`)) return;
    await grp.update(activeGroup.id, { clients: pickedAsGroupClients() });
  };
  const renameActiveGroup = async () => {
    if (!activeGroup) return;
    const name = window.prompt('그룹 이름', activeGroup.name); if (!name?.trim()) return;
    await grp.update(activeGroup.id, { name: name.trim() });
  };
  const deleteActiveGroup = async () => {
    if (!activeGroup) return;
    if (!window.confirm(`'${activeGroup.name}' 그룹을 삭제할까요? (거래처 데이터는 그대로)`)) return;
    await grp.remove(activeGroup.id);
    clearGroup();
  };

  // 거래처명·코드 검색 (클라이언트 필터) + 활성 그룹 필터
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const groupCodes = activeGroup ? new Set(activeGroup.clients.map((c) => c.code)) : null;
  const shownClients = s.clients.filter(
    (c) =>
      (!groupCodes || groupCodes.has(c.client_code)) &&
      (!q ||
        (c.client_name || '').toLowerCase().includes(q) ||
        (c.client_code || '').toLowerCase().includes(q)),
  );

  const selectableClients = shownClients.filter((c) => c.client_code);
  const allSelected = selectableClients.length > 0 && selectableClients.every((c) => picked.has(c.client_code));
  const togglePick = (code: string) =>
    setPicked((prev) => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const toggleAll = () =>
    setPicked(() => (allSelected ? new Set() : new Set(selectableClients.map((c) => c.client_code))));
  const runBatch = (opts?: { gradeStepUp?: boolean | 'auto' }) => {
    // 그룹 구성원은 이번 기간 목록에 없어도 견적 대상에 포함(이름은 그룹에 저장된 값 사용)
    const targets = pickedAsGroupClients().map((c) => ({ client_code: c.code, client_name: c.name }));
    void batch.run(targets, { ...opts, cols: cols.quoteCols });
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

      {/* 거래처 검색 */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="거래처명 또는 코드 검색"
        style={{
          padding: '10px 14px', borderRadius: 8,
          border: '1px solid var(--border-default)', fontSize: 14,
          background: '#fff', color: 'var(--text-primary)', outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
      />

      {batchable && (
        <ClientGroupBar
          groups={grp.groups}
          activeId={activeGroupId}
          pickedCount={picked.size}
          onPickGroup={pickGroup}
          onClearGroup={clearGroup}
          onSaveNew={saveNewGroup}
          onAddToGroup={addToGroup}
          onRemoveFromActive={removeFromActiveGroup}
          onUpdateActive={updateActiveGroup}
          onRenameActive={renameActiveGroup}
          onDeleteActive={deleteActiveGroup}
        />
      )}

      {batchable && (
        <BatchRecommendBar
          count={picked.size}
          running={batch.running}
          progress={batch.progress}
          message={batch.message}
          onRun={runBatch}
          onClear={() => setPicked(new Set())}
          quoteCols={cols.quoteCols}
          onToggleCol={cols.toggle}
          onMoveCol={cols.move}
          onResetCols={cols.reset}
        />
      )}

      <ClientsTable
        clients={shownClients}
        winbackMap={s.type === 'wine' ? winbackMap : undefined}
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

      {!s.loading && s.clients.length > 0 && (
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
