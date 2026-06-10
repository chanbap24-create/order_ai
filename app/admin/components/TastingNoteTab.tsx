'use client';

import { useState } from 'react';
import { useTastingNoteList } from '../tasting-note/hooks/useTastingNoteList';
import { useTastingNoteBatch } from '../tasting-note/hooks/useTastingNoteBatch';
import { useWineDetail } from '../new-wine/hooks/useWineDetail';
import { NoteToolbar } from '../tasting-note/components/NoteToolbar';
import { NoteListPanel } from '../tasting-note/components/NoteListPanel';
import { WineEditPanel } from '../new-wine/components/WineEditPanel';
import { ResearchDetailPanel } from '../new-wine/components/ResearchDetailPanel';
import { ProgressBars } from '../new-wine/components/ProgressBars';
import type { NoteFilter } from '../tasting-note/types';

export default function TastingNoteTab({ initialFilter = 'all' }: { initialFilter?: NoteFilter }) {
  const list = useTastingNoteList(initialFilter);
  const detail = useWineDetail(list.fetchWines);
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
