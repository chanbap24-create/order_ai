'use client';

import { useState } from 'react';
import type { ClientOption } from '../recommend/types';
import { useManagers } from '../recommend/hooks/useManagers';
import { useClientSearch } from '../recommend/hooks/useClientSearch';
import { useRecommend } from '../recommend/hooks/useRecommend';
import { useQuoteCols } from '../recommend/hooks/useQuoteCols';
import { useQuoteExport } from '../recommend/hooks/useQuoteExport';
import { ClientPickerCard } from '../recommend/components/ClientPickerCard';
import { SummaryCard } from '../recommend/components/SummaryCard';
import { RecommendationList } from '../recommend/components/RecommendationList';
import { BottomActionBar } from '../recommend/components/BottomActionBar';

type Props = {
  currentManager: string;
  isAdmin: boolean;
  preselectedClient?: ClientOption | null;
};

export default function RecommendTab({ currentManager, isAdmin, preselectedClient }: Props) {
  const [filterManager, setFilterManager] = useState(isAdmin ? '' : currentManager);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const managers = useManagers(isAdmin);
  const cs = useClientSearch(filterManager, preselectedClient);
  const rec = useRecommend();
  const cols = useQuoteCols();
  const exp = useQuoteExport({ quoteCols: cols.quoteCols, selectedClient: cs.selectedClient });

  const handleSelectClient = (c: ClientOption) => {
    cs.selectClient(c);
    rec.setResult(null);
  };

  const handleClearClient = () => {
    cs.clearClient();
    rec.setResult(null);
  };

  const handleGenerate = () => {
    if (!cs.selectedClient) return;
    setSelected(new Set());
    rec.generate(cs.selectedClient);
  };

  const toggleSelect = (itemNo: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo); else next.add(itemNo);
      return next;
    });
  };

  const items = rec.result?.recommendations || [];
  const allSelected = items.length > 0 && items.every(i => selected.has(i.item_no));

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) items.forEach(i => next.delete(i.item_no));
      else items.forEach(i => next.add(i.item_no));
      return next;
    });
  };

  const selectedItems = items.filter(i => selected.has(i.item_no));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + (i.price || 0), 0);

  return (
    <div style={{ paddingBottom: 100 }}>
      <ClientPickerCard
        isAdmin={isAdmin}
        managers={managers}
        filterManager={filterManager}
        onFilterManagerChange={(v) => {
          setFilterManager(v);
          cs.clearClient();
          rec.setResult(null);
        }}
        dropdownRef={cs.dropdownRef}
        clientSearch={cs.clientSearch}
        onSearchChange={(v) => { cs.setClientSearch(v); cs.setSelectedClient(null); }}
        onFocus={() => { if (cs.clientOptions.length > 0) cs.setShowDropdown(true); }}
        selectedClient={cs.selectedClient}
        onClear={handleClearClient}
        showDropdown={cs.showDropdown}
        clientOptions={cs.clientOptions}
        clientLoading={cs.clientLoading}
        onSelect={handleSelectClient}
        loading={rec.loading}
        onGenerate={handleGenerate}
      />

      {rec.error && (
        <div style={{ background: '#fff5f5', color: '#c53030', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {rec.error}
        </div>
      )}

      {rec.result && (
        <>
          <SummaryCard result={rec.result} />
          <RecommendationList
            items={items}
            selected={selected}
            onToggle={toggleSelect}
            allSelected={allSelected}
            onToggleAll={toggleAll}
          />
        </>
      )}

      {rec.result && selected.size > 0 && (
        <BottomActionBar
          selectedCount={selected.size}
          selectedTotal={selectedTotal}
          quoteLoading={exp.quoteLoading}
          onAdd={() => exp.createQuote(selectedItems, 'add')}
          onDownload={() => exp.createQuote(selectedItems, 'download')}
          quoteCols={cols.quoteCols}
          toggleCol={cols.toggle}
          resetCols={cols.reset}
        />
      )}

      {exp.quoteResult && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: exp.quoteResult.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 300,
          boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
        }}>
          {exp.quoteResult}
        </div>
      )}

      {!rec.result && !rec.loading && !rec.error && !cs.selectedClient && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          <svg
            width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginBottom: 16 }}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI 추천 엔진</div>
          <div>거래처를 검색하고 선택하면<br />맞춤 와인 추천을 생성합니다</div>
        </div>
      )}
    </div>
  );
}
