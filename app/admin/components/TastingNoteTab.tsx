'use client';

import { useState, useEffect, useRef } from 'react';
import { useTastingNoteList } from '../tasting-note/hooks/useTastingNoteList';
import { useTastingNoteBatch } from '../tasting-note/hooks/useTastingNoteBatch';
import { useNewWinePipeline } from '../tasting-note/hooks/useNewWinePipeline';
import { useWineDetail } from '../new-wine/hooks/useWineDetail';
import { NoteToolbar } from '../tasting-note/components/NoteToolbar';
import { NoteListPanel } from '../tasting-note/components/NoteListPanel';
import { NewWinePopup } from '../tasting-note/components/NewWinePopup';
import { WineEditPanel } from '../new-wine/components/WineEditPanel';
import { ResearchDetailPanel } from '../new-wine/components/ResearchDetailPanel';
import { ProgressBars } from '../new-wine/components/ProgressBars';
import type { NoteFilter, TastingWineRow } from '../tasting-note/types';

const SEEN_KEY = 'tn_new_seen'; // 이미 알린 신규 품번(중복 팝업 방지)

export default function TastingNoteTab({
  initialFilter = 'all',
  onNewCountChange,
}: {
  initialFilter?: NoteFilter;
  onNewCountChange?: (n: number) => void;
}) {
  const list = useTastingNoteList(initialFilter);

  // 탭 배지용 신규 작업대상 수를 부모로 전달 (노트 작성/제외 시 실시간 갱신)
  useEffect(() => {
    onNewCountChange?.(list.newActionableCount);
  }, [list.newActionableCount, onNewCountChange]);
  const detail = useWineDetail(list.fetchWines, list.patchWine);
  const ops = useTastingNoteBatch({
    wines: list.wines,
    checkedIds: list.checkedIds,
    setCheckedIds: list.setCheckedIds,
    refreshList: list.fetchWines,
    refreshGhIndex: list.refreshGhIndex,
    loadSelectedDetail: detail.loadWineDetail,
    selectedId: list.selectedId,
  });

  const [showDetailPanel, setShowDetailPanel] = useState(true);

  // 신규 와인 일괄 파이프라인 팝업 — 수동 트리거 전용.
  // (재고 업로드 후 자동 감지 알림은 전역 NewWineAlert 가 담당 → 어느 탭에서도 즉시 표시)
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupWines, setPopupWines] = useState<TastingWineRow[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    try { seenRef.current = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { /* ignore */ }
  }, []);

  const pipeline = useNewWinePipeline({
    onDone: () => { list.fetchWines(); list.refreshGhIndex(true); },
  });

  const closePopup = () => {
    for (const w of popupWines) seenRef.current.add(w.item_code);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenRef.current])); } catch { /* ignore */ }
    setPopupOpen(false);
  };

  // 수동 트리거: 체크한 와인으로 동일 파이프라인 팝업 열기(신규 0개여도 테스트·실행 가능)
  const openPipelineForChecked = () => {
    const rows = list.wines.filter((w) => list.checkedIds.has(w.item_code));
    if (rows.length === 0) return;
    setPopupWines(rows);
    setPopupOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      {popupOpen && popupWines.length > 0 && (
        <NewWinePopup
          wines={popupWines}
          running={pipeline.running}
          progress={pipeline.progress}
          result={pipeline.result}
          onRun={pipeline.run}
          onClose={closePopup}
        />
      )}

      <NoteToolbar
        filterNote={list.filterNote}
        setFilterNote={list.setFilterNote}
        counts={list.counts}
        search={list.search}
        setSearch={list.setSearch}
        hideZero={list.hideZero}
        setHideZero={list.setHideZero}
        wineOnly={list.wineOnly}
        setWineOnly={list.setWineOnly}
        showExcluded={list.showExcluded}
        setShowExcluded={list.setShowExcluded}
        lowStockThreshold={list.lowStockThreshold}
        setLowStockThreshold={list.setLowStockThreshold}
        checkedSize={list.checkedIds.size}
        ops={ops}
        onOpenPipeline={openPipelineForChecked}
      />

      {list.ghError && (
        <div
          role="alert"
          style={{
            margin: '8px 0',
            padding: '8px 12px',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 6,
            color: '#92400e',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠️ PDF 발행 인덱스를 불러오지 못했습니다. 신규/미작성/작성완료 카운트가 정확하지 않을 수 있습니다.</span>
          <button
            type="button"
            onClick={() => list.refreshGhIndex(true)}
            style={{
              marginLeft: 'auto',
              padding: '2px 10px',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      <ProgressBars
        batchRunning={ops.batchRunning}
        batchProgress={ops.batchProgress}
        batchPptRunning={ops.batchPptRunning}
        batchPptProgress={ops.batchPptProgress}
      />

      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden' }}>
        <NoteListPanel
          wines={list.filteredWines}
          loading={list.loading}
          ghIndex={list.ghIndex}
          selectedId={list.selectedId}
          checkedIds={list.checkedIds}
          onSelect={(wine) => {
            list.setSelectedId(wine.item_code);
            detail.selectWineFromList(wine);
          }}
          toggleCheck={list.toggleCheck}
          toggleAllChecks={list.toggleAllChecks}
          uploadingFileId={ops.uploadingFileId}
          onUploadFile={ops.uploadFileForWine}
          onSetExcluded={list.setExcluded}
          onBackfill={ops.backfillFromNote}
          backfillingId={ops.backfillingId}
        />

        <WineEditPanel
          detail={detail}
          generatingPpt={ops.generatingPpt}
          onGeneratePpt={ops.generatePpt}
        />

        <ResearchDetailPanel
          tastingNote={detail.tastingNote}
          show={showDetailPanel}
          setShow={setShowDetailPanel}
          hasSelectedWine={!!detail.selectedWine}
        />
      </div>
    </div>
  );
}
