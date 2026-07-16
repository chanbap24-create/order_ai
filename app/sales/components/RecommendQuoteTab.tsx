'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClientOption, ScoredItem } from '../recommend/types';
import { selectQuoteItems } from '../recommend/allocateByTypeShares';
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
import { renderQuoteImage, vintageFromCode } from '../recommend/lib/quoteImage';
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
    stepUpApplied: rec.result?.client?.step_up_applied === true,
  });

  // lazy 초기화로 처음부터 저장값 사용(remount 시 DEFAULT 로 덮어쓰는 레이스 방지).
  // 컨트롤은 rec.result 이후에만 렌더되어 SSR 하이드레이션 불일치 없음.
  const [settings, setSettings] = useState<RecSettings>(loadRecSettings);
  const [anchor, setAnchor] = useState<AnchorItem | null>(null); // 대체상품 모드 기준 상품(쇼트난 품목)
  const items = rec.result?.recommendations || [];
  // 선정·정렬은 공용 파이프라인(selectQuoteItems)에 위임 — 거래처 일괄 추천과 동일 결과 보장.
  const shares = rec.result?.typeShares || {};
  const visible: ScoredItem[] = selectQuoteItems(items, shares, {
    lockCount: settings.lockCount, maxPerType: settings.maxPerType, minScore: settings.minScore,
  });

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
    // 새 추천 생성 = 새 견적 시작 — 이전에 담긴 견적 항목은 비운다(옛 할인조건·비고 잔존 방지)
    quote.clearAllQuoteSilent();
    rec.generate(cs.selectedClient, settings, anchorArg(anchor));
  };
  const reapplyWith = (st: RecSettings) => { if (cs.selectedClient && rec.result) rec.generate(cs.selectedClient, st, anchorArg(anchor)); };

  // 이 거래처 할인 보정(매출등급 1단계↑) — 생성 전에 켜고 끄는 단일 토글.
  // 이미 결과가 있으면 토글 즉시 재생성. ('auto'는 일괄 생성용 값 — 개별에선 켬으로 취급)
  const stepUpOn = settings.gradeStepUp === true || settings.gradeStepUp === 'auto';
  const toggleStepUp = () => {
    const ns = { ...settings, gradeStepUp: !stepUpOn };
    setSettings(ns);
    // 상단 등급 카드(ClientGradeInfo)의 '현재 할인률'도 즉시 보정치로 전환
    window.dispatchEvent(new CustomEvent('rec-stepup-change', { detail: { on: !stepUpOn } }));
    if (rec.result && cs.selectedClient) rec.generate(cs.selectedClient, ns, anchorArg(anchor));
  };
  // 토글 옆 할인률 미리보기: 현재 등급 할인률 → 보정 시 할인률 (거래처 단위, 수량가산 제외)
  const [rates, setRates] = useState<{ code: string; cur: number; step: number } | null>(null);
  useEffect(() => {
    const code = cs.selectedClient?.client_code;
    if (!code) return;
    (async () => {
      try {
        const r = await fetch(`/api/sales/clients/grade?client_code=${encodeURIComponent(code)}`, { credentials: 'include' });
        const d = await r.json();
        if (d?.benefit?.rate != null && d?.benefitStepUp?.rate != null) {
          setRates({ code, cur: d.benefit.rate, step: d.benefitStepUp.rate });
        }
      } catch { /* 미리보기 실패는 무시 */ }
    })();
  }, [cs.selectedClient?.client_code]);
  // 거래처가 바뀌면 이전 거래처 미리보기는 숨김(코드 일치 시에만 표시)
  const ratesForClient = rates && rates.code === cs.selectedClient?.client_code ? rates : null;

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

  // 카톡 전송용 PNG 견적서 — 선택 품목을 이미지로 렌더해 즉시 다운로드
  const downloadPng = async () => {
    if (!cs.selectedClient || selectedItems.length === 0) return;
    try {
      const blob = await renderQuoteImage({
        clientName: cs.selectedClient.client_name,
        date: new Date().toISOString().slice(0, 10),
        items: selectedItems.map((it) => ({
          name: it.item_name,
          country: it.country || '',
          vintage: vintageFromCode(it.item_no),
          supply: it.price || 0,
          rate: it.rec_discount || 0,
          qty: it.rec_quantity || 1,
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `견적서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${cs.selectedClient.client_name.replace(/[\\/:*?"<>|]/g, '_')}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('PNG 생성에 실패했습니다.'); }
  };

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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12,
          padding: '10px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>할인 보정</span>
          <button
            onClick={toggleStepUp}
            title="이 거래처를 매출등급 한 단계 위로 취급해 할인율 산출(업소·샵) — 프로모션 제안용"
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${stepUpOn ? 'var(--action)' : 'var(--gray-300)'}`,
              background: stepUpOn ? 'var(--action)' : '#fff',
              color: stepUpOn ? '#fff' : 'var(--text-tertiary)',
            }}
          >
            {stepUpOn ? '켬 · 매출등급 1단계↑' : '끔'}
          </button>
          {ratesForClient && (
            ratesForClient.cur === ratesForClient.step ? (
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                할인률 <b>{Math.round(ratesForClient.cur * 100)}%</b> — 이미 최상위 매출등급이라 변화 없음
              </span>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                할인률{' '}
                <b style={{ color: stepUpOn ? 'var(--text-muted)' : 'var(--action)', textDecoration: stepUpOn ? 'line-through' : 'none' }}>
                  {Math.round(ratesForClient.cur * 100)}%
                </b>
                {' → '}
                <b style={{ color: stepUpOn ? 'var(--action)' : 'var(--text-muted)' }}>
                  {Math.round(ratesForClient.step * 100)}%
                </b>
              </span>
            )
          )}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            생성 전에 선택 — 이 거래처 견적의 할인율·후보 가격대에 반영
          </span>
        </div>
      )}

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
              background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12,
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
          onDownloadPng={downloadPng}
          quoteCols={cols.quoteCols}
          toggleCol={cols.toggle}
          reorderCols={cols.reorder}
          resetCols={cols.reset}
        />
      )}

      {exp.quoteResult && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: exp.quoteResult.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
