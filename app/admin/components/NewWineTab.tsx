'use client';

import { useState } from 'react';
import { useNewWineList } from '../new-wine/hooks/useNewWineList';
import { useWineDetail } from '../new-wine/hooks/useWineDetail';
import { useBatchOperations } from '../new-wine/hooks/useBatchOperations';
import { Toolbar } from '../new-wine/components/Toolbar';
import { ProgressBars } from '../new-wine/components/ProgressBars';
import { WineListPanel } from '../new-wine/components/WineListPanel';
import { WineEditPanel } from '../new-wine/components/WineEditPanel';
import { ResearchDetailPanel } from '../new-wine/components/ResearchDetailPanel';

export default function NewWineTab() {
  const list = useNewWineList();
  const detail = useWineDetail(list.fetchWines);
  const ops = useBatchOperations({
    wines: list.wines,
    checkedIds: list.checkedIds,
    setCheckedIds: list.setCheckedIds,
    refreshList: list.fetchWines,
    loadSelectedDetail: detail.loadWineDetail,
    selectedId: list.selectedId,
  });

  const [showDetailPanel, setShowDetailPanel] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <Toolbar
        statusFilter={list.statusFilter}
        setStatusFilter={list.setStatusFilter}
        counts={list.counts}
        search={list.search}
        setSearch={list.setSearch}
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
        <WineListPanel
          wines={list.wines}
          loading={list.loading}
          selectedId={list.selectedId}
          checkedIds={list.checkedIds}
          onSelect={(wine) => {
            list.setSelectedId(wine.item_code);
            detail.selectWineFromList(wine);
          }}
          toggleCheck={list.toggleCheck}
          toggleAllChecks={list.toggleAllChecks}
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
