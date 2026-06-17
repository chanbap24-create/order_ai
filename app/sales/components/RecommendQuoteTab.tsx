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
import { RecommendAnalysisCard } from '../recommend/components/RecommendAnalysisCard';
import { RecommendationList } from '../recommend/components/RecommendationList';
import { BottomActionBar } from '../recommend/components/BottomActionBar';
import { useQuoteManager } from '@/app/inventory/hooks/useQuoteManager';
import { useQuoteItems } from '@/app/inventory/hooks/useQuoteItems';
import { RecommendQuoteEditPanel } from './RecommendQuoteEditPanel';

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
  const qm = useQuoteManager();
  const quote = useQuoteItems({ quoteManager: qm.quoteManager, getManagerParam: qm.getManagerParam });
  const exp = useQuoteExport({
    quoteCols: cols.quoteCols,
    selectedClient: cs.selectedClient,
    manager: qm.getManagerParam(),
    onAdded: quote.fetchQuoteItems,
  });

  const [priceBand, setPriceBand] = useState(20); // 가격 밴드 ±% (하드 게이트, 서버 적용)
  const [periodMonths, setPeriodMonths] = useState(6); // 분석 기간(개월)
  const items = rec.result?.recommendations || [];
  const visible = items; // 게이트는 서버에서 적용 — 받은 건 모두 표시

  // 새 결과 도착 시 전체 선택 기본값 (렌더 중 prop 변화 감지: effect 불필요)
  const [prevResult, setPrevResult] = useState(rec.result);
  if (rec.result !== prevResult) {
    setPrevResult(rec.result);
    setSelected(new Set(items.map((i) => i.item_no)));
    // 견적 편집 거래처명을 선택한 거래처로 미리 채움
    if (rec.result && cs.selectedClient) quote.setClientName(cs.selectedClient.client_name);
  }

  // 거래처를 바꾸면 이전 거래처의 견적/결과를 비움
  const handleSelectClient = (c: ClientOption) => { cs.selectClient(c); rec.setResult(null); quote.clearAllQuoteSilent(); };
  const handleClearClient = () => { cs.clearClient(); rec.setResult(null); quote.clearAllQuoteSilent(); };
  const handleGenerate = () => { if (cs.selectedClient) rec.generate(cs.selectedClient, priceBand / 100, periodMonths); };
  const reapply = () => { if (cs.selectedClient && rec.result) rec.generate(cs.selectedClient, priceBand / 100, periodMonths); };

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
        onFilterManagerChange={(v) => { setFilterManager(v); cs.clearClient(); rec.setResult(null); quote.clearAllQuoteSilent(); }}
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
          <RecommendAnalysisCard summary={rec.result.summary} />
          {rec.result.comment && (
            <div style={{
              background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10,
              padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.6, color: '#3730a3',
            }}>
              <b style={{ fontWeight: 700 }}>🍷 추천 코멘트</b><br />
              {rec.result.comment}
            </div>
          )}
          {/* 조절 — 분석 기간 + 가격 밴드 (둘 다 서버 적용, 변경 시 재생성) */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 10,
            padding: '10px 14px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 72 }}>분석 기간</span>
              <input
                type="range" min={1} max={24} step={1} value={periodMonths}
                onChange={(e) => setPeriodMonths(Number(e.target.value))}
                onMouseUp={reapply} onTouchEnd={reapply}
                style={{ flex: 1, minWidth: 120, accentColor: 'var(--action)' }}
              />
              <input
                type="number" min={1} max={24} value={periodMonths}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setPeriodMonths(Number.isFinite(v) ? Math.min(24, Math.max(1, v)) : 6);
                }}
                onBlur={reapply}
                style={{ width: 56, padding: '3px 6px', fontSize: 13, textAlign: 'center', border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>개월 · 최근 {periodMonths}개월 구매 기준</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 72 }}>가격 밴드 ±</span>
              <input
                type="range" min={5} max={100} step={5} value={priceBand}
                onChange={(e) => setPriceBand(Number(e.target.value))}
                onMouseUp={reapply} onTouchEnd={reapply}
                style={{ flex: 1, minWidth: 120, accentColor: 'var(--action)' }}
              />
              <input
                type="number" min={5} max={100} value={priceBand}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setPriceBand(Number.isFinite(v) ? Math.min(100, Math.max(5, v)) : 20);
                }}
                onBlur={reapply}
                style={{ width: 56, padding: '3px 6px', fontSize: 13, textAlign: 'center', border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>% · 평균가 ±{priceBand}% 이내 · {items.length}개</span>
            </div>
          </div>
          <RecommendationList
            items={visible}
            selected={selected}
            onToggle={toggleSelect}
            allSelected={allSelected}
            onToggleAll={toggleAll}
          />

          {/* 하단 견적 편집 패널 — 견적서 빌더 재사용(할인률·수량·컬럼·발행) */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              견적 편집
            </h3>
            <RecommendQuoteEditPanel quote={quote} getManagerParam={qm.getManagerParam} />
          </div>
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
