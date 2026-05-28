'use client';

import { useState } from 'react';
import type { AnalysisFilters, SelectedRankClient } from '../analysis/types';
import { AnalysisSection } from '../analysis/components/AnalysisSection';
import { ClientDetailPanel } from '../analysis/components/ClientDetailPanel';

type Props = { currentManager: string; isAdmin: boolean };

type Selection = { client: SelectedRankClient; filters: AnalysisFilters };

export default function AnalysisTab({ currentManager, isAdmin }: Props) {
  const [selected, setSelected] = useState<Selection | null>(null);

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
    <AnalysisSection
      currentManager={currentManager}
      isAdmin={isAdmin}
      onSelectClient={(client, filters) => setSelected({ client, filters })}
    />
  );
}
