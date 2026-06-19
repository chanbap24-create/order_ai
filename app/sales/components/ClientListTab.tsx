'use client';

import { useState } from 'react';
import { useClientList } from '../client-list/hooks/useClientList';
import { FilterPanel } from '../client-list/components/FilterPanel';
import { SummaryCards } from '../client-list/components/SummaryCards';
import { ClientsTable } from '../client-list/components/ClientsTable';
import { ClientDetailPanel } from '../analysis/components/ClientDetailPanel';
import type { SelectedRankClient, AnalysisFilters } from '../analysis/types';
import { Stack } from '@/app/components/ui';

export default function ClientListTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const s = useClientList({ currentManager, isAdmin });
  const [selected, setSelected] = useState<{ client: SelectedRankClient; filters: AnalysisFilters } | null>(null);

  if (selected) {
    return (
      <ClientDetailPanel
        client={selected.client}
        currentManager={currentManager}
        isAdmin={isAdmin}
        filters={selected.filters}
        onBack={() => setSelected(null)}
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

      <ClientsTable
        clients={s.clients}
        loading={s.loading}
        sortKey={s.sortKey}
        onSort={s.handleSort}
        sortIcon={s.sortIcon}
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
