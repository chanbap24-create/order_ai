'use client';

import { useState } from 'react';
import type { ClientOption } from '../recommend/types';
import { useManagers } from '../recommend/hooks/useManagers';
import { useClientSearch } from '../recommend/hooks/useClientSearch';
import { useRecommendQuote } from '../recommend/hooks/useRecommendQuote';
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

export default function RecommendQuoteTab({ currentManager, isAdmin, preselectedClient }: Props) {
  const [filterManager, setFilterManager] = useState(isAdmin ? '' : currentManager);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const managers = useManagers(isAdmin);
  const cs = useClientSearch(filterManager, preselectedClient);
  const rec = useRecommendQuote();
  const cols = useQuoteCols();
  const exp = useQuoteExport({ quoteCols: cols.quoteCols, selectedClient: cs.selectedClient });

  const [minScore, setMinScore] = useState(0); // 추천점수 허들
  const items = rec.result?.recommendations || [];
  const visible = items.filter((i) => i.score >= minScore); // 허들 통과분만 표시/담기

  // LLM 이 이미 선별 → 새 결과 도착 시 전체 선택 기본값 (렌더 중 prop 변화 감지: effect 불필요)
  const [prevResult, setPrevResult] = useState(rec.result);
  if (rec.result !== prevResult) {
    setPrevResult(rec.result);
    setSelected(new Set(items.map((i) => i.item_no)));
  }

  const handleSelectClient = (c: ClientOption) => { cs.selectClient(c); rec.setResult(null); };
  const handleClearClient = () => { cs.clearClient(); rec.setResult(null); };
  const handleGenerate = () => { if (cs.selectedClient) rec.generate(cs.selectedClient); };

  const toggleSelect = (itemNo: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo); else next.add(itemNo);
      return next;
    });
  };
  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.item_no));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((i) => next.delete(i.item_no));
      else visible.forEach((i) => next.add(i.item_no));
      return next;
    });
  };

  const selectedItems = visible.filter((i) => selected.has(i.item_no));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + (i.price || 0), 0);

  return (
    <div style={{ paddingBottom: 100 }}>
      <ClientPickerCard
        isAdmin={isAdmin}
        managers={managers}
        filterManager={filterManager}
        onFilterManagerChange={(v) => { setFilterManager(v); cs.clearClient(); rec.setResult(null); }}
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

      {rec.loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          최근 6개월 입고·취향을 분석해 추천 견적을 만드는 중…
        </div>
      )}

      {rec.error && (
        <div style={{ background: '#fff5f5', color: '#c53030', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {rec.error}
        </div>
      )}

      {rec.result && (
        <>
          <SummaryCard result={rec.result} />
          {rec.result.comment && (
            <div style={{
              background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10,
              padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.6, color: '#3730a3',
            }}>
              <b style={{ fontWeight: 700 }}>🍷 추천 코멘트</b><br />
              {rec.result.comment}
            </div>
          )}
          {/* 추천점수 허들 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 10,
            padding: '10px 14px', marginBottom: 12,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>추천점수 허들</span>
            <input
              type="range" min={0} max={60} step={1} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              style={{ flex: 1, minWidth: 120, accentColor: 'var(--action)' }}
            />
            <input
              type="number" min={0} max={60} value={minScore}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMinScore(Number.isFinite(v) ? Math.min(60, Math.max(0, v)) : 0);
              }}
              style={{
                width: 56, padding: '3px 6px', fontSize: 13, textAlign: 'center',
                border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              점 이상 · {visible.length}/{items.length}개
            </span>
          </div>
          <RecommendationList
            items={visible}
            selected={selected}
            onToggle={toggleSelect}
            allSelected={allSelected}
            onToggleAll={toggleAll}
          />
        </>
      )}

      {rec.result && selectedItems.length > 0 && (
        <BottomActionBar
          selectedCount={selectedItems.length}
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
          fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
        }}>
          {exp.quoteResult}
        </div>
      )}

      {!rec.result && !rec.loading && !rec.error && !cs.selectedClient && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI 추천 견적서</div>
          <div>거래처를 선택하면 최근 6개월 입고 와인과<br />취향(테이스팅 노트)을 분석해 맞춤 견적을 제안합니다</div>
        </div>
      )}
    </div>
  );
}
