'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { RecControls } from '../recommend/components/RecControls';
import { RecModeSelector, type AnchorItem } from '../recommend/components/RecModeSelector';
import { type RecSettings, type RecMode, loadRecSettings, saveRecSettings } from '../recommend/recSettings';
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
  // 추천견적 작업 초안은 인벤토리 견적과 분리(같은 manager면 초안이 공유됨).
  // '::rec' 스코프로 quote_items 를 따로 적재·편집. 저장 기록(saved_quotes)은 export 시 실제 manager로 저장돼 공유됨.
  const getRecManager = useCallback(() => {
    const m = qm.getManagerParam();
    return m ? `${m}::rec` : '';
  }, [qm]);
  const quote = useQuoteItems({ quoteManager: qm.quoteManager, getManagerParam: getRecManager });
  const exp = useQuoteExport({
    quoteCols: cols.quoteCols,
    selectedClient: cs.selectedClient,
    manager: getRecManager(),
    onAdded: quote.fetchQuoteItems,
  });

  // lazy 초기화로 처음부터 저장값 사용(remount 시 DEFAULT 로 덮어쓰는 레이스 방지).
  // 컨트롤은 rec.result 이후에만 렌더되어 SSR 하이드레이션 불일치 없음.
  const [settings, setSettings] = useState<RecSettings>(loadRecSettings);
  const [anchor, setAnchor] = useState<AnchorItem | null>(null); // 대체상품 모드 기준 상품(쇼트난 품목)
  const items = rec.result?.recommendations || [];
  // 추천 개수 고정(락): items 는 점수 내림차순 → 상위 N개를 취하면
  // 초과분 컷(조건 통과>N)·부족분 백필(조건 통과<N, 다음 점수로 채움)이 동시에 해결됨.
  // 락 끔(0)이면 점수 허들(minScore) 즉시 필터만 적용.
  const visible = settings.lockCount > 0
    ? items.slice(0, settings.lockCount)
    : items.filter((i) => i.score >= settings.minScore);

  // 설정 변경 시 저장(영업사원별, localStorage)
  useEffect(() => { saveRecSettings(settings); }, [settings]);

  // 새 결과 도착 시 전체 선택 기본값 (렌더 중 prop 변화 감지: effect 불필요)
  const [prevResult, setPrevResult] = useState(rec.result);
  if (rec.result !== prevResult) {
    setPrevResult(rec.result);
    setSelected(new Set(items.map((i) => i.item_no)));
    // 견적 편집 거래처명을 선택한 거래처로 미리 채움
    if (rec.result && cs.selectedClient) quote.setClientName(cs.selectedClient.client_name);
  }

  // 거래처를 바꾸면 이전 거래처의 견적/결과/기준상품을 비움
  const handleSelectClient = (c: ClientOption) => { cs.selectClient(c); rec.setResult(null); setAnchor(null); quote.clearAllQuoteSilent(); };
  const handleClearClient = () => { cs.clearClient(); rec.setResult(null); setAnchor(null); quote.clearAllQuoteSilent(); };
  // 모드 변경: 기준상품·결과 초기화
  const handleModeChange = (m: RecMode) => { setSettings((p) => ({ ...p, mode: m })); setAnchor(null); rec.setResult(null); };
  const anchorArg = (a: AnchorItem | null) => (a ? { item_code: a.item_code, price: a.price } : null);
  const handleGenerate = () => {
    if (!cs.selectedClient) return;
    if (settings.mode === 'substitute' && !anchor) return; // 기준 상품 선택 전엔 생성 안 함
    rec.generate(cs.selectedClient, settings, anchorArg(anchor));
  };
  const reapplyWith = (st: RecSettings) => { if (cs.selectedClient && rec.result) rec.generate(cs.selectedClient, st, anchorArg(anchor)); };

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

      {cs.selectedClient && (
        <RecModeSelector
          clientCode={cs.selectedClient.client_code}
          mode={settings.mode}
          onModeChange={handleModeChange}
          anchor={anchor}
          onAnchorChange={setAnchor}
          discovery={{
            types: settings.discoveryTypes,
            minPrice: settings.discoveryMinPrice,
            maxPrice: settings.discoveryMaxPrice,
            segment: settings.discoverySegment,
          }}
          onDiscoveryChange={(patch) => setSettings((p) => ({ ...p, ...patch }))}
          includeNonStandard={settings.includeNonStandard}
          onToggleNonStandard={(v) => setSettings((p) => ({ ...p, includeNonStandard: v }))}
          discountApply={settings.discountApply}
          discountScope={settings.discountScope}
          onDiscountChange={(patch) => setSettings((p) => ({ ...p, ...patch }))}
          onGenerate={handleGenerate}
          loading={rec.loading}
        />
      )}

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
          <RecControls
            settings={settings}
            onChange={setSettings}
            onReapply={reapplyWith}
            itemsCount={items.length}
            visibleCount={visible.length}
            loading={rec.loading}
          />
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
            <RecommendQuoteEditPanel quote={quote} getManagerParam={getRecManager} />
          </div>
        </>
      )}

      {rec.result && selectedItems.length > 0 && (
        <BottomActionBar
          selectedCount={selectedItems.length}
          selectedTotal={selectedTotal}
          quoteLoading={exp.quoteLoading}
          onDownload={() => exp.createQuote(selectedItems, 'fill')}
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
