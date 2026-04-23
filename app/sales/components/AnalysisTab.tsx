'use client';

import { useState } from 'react';
import type { SelectedRankClient } from '../analysis/types';
import { AnalysisSection } from '../analysis/components/AnalysisSection';
import { ClientDetailPanel } from '../analysis/components/ClientDetailPanel';

type Props = { currentManager: string; isAdmin: boolean };

export default function AnalysisTab({ currentManager, isAdmin }: Props) {
  const [selectedClient, setSelectedClient] = useState<SelectedRankClient | null>(null);

  if (selectedClient) {
    return (
      <ClientDetailPanel
        client={selectedClient}
        currentManager={currentManager}
        isAdmin={isAdmin}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <AnalysisSection
      currentManager={currentManager}
      isAdmin={isAdmin}
      onSelectClient={setSelectedClient}
    />
  );
}
