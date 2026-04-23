'use client';

import { useClientList } from '../client-list/hooks/useClientList';
import { FilterPanel } from '../client-list/components/FilterPanel';
import { SummaryCards } from '../client-list/components/SummaryCards';
import { ClientsTable } from '../client-list/components/ClientsTable';

export default function ClientListTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const s = useClientList({ currentManager, isAdmin });

  return (
    <div>
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

      <ClientsTable
        clients={s.clients}
        loading={s.loading}
        sortKey={s.sortKey}
        onSort={s.handleSort}
        sortIcon={s.sortIcon}
      />

      {!s.loading && s.clients.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#a8a098', marginTop: 12 }}>
          {s.startDate} ~ {s.endDate} · {s.managerFilter} · {s.businessType || '전체 업종'} · {s.type === 'wine' ? 'Wine' : 'Glass'}
        </div>
      )}
    </div>
  );
}
