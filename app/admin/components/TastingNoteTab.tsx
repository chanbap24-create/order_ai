'use client';

import { useState, useEffect } from 'react';
import { useTastingNoteList } from '../tasting-note/hooks/useTastingNoteList';
import { useTastingNoteBatch } from '../tasting-note/hooks/useTastingNoteBatch';
import { useWineDetail } from '../new-wine/hooks/useWineDetail';
import { NoteToolbar } from '../tasting-note/components/NoteToolbar';
import { NoteListPanel } from '../tasting-note/components/NoteListPanel';
import { WineEditPanel } from '../new-wine/components/WineEditPanel';
import { ResearchDetailPanel } from '../new-wine/components/ResearchDetailPanel';
import { ProgressBars } from '../new-wine/components/ProgressBars';
import type { NoteFilter } from '../tasting-note/types';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
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
