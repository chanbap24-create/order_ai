'use client';

import { useEffect, useState } from 'react';
import type { WineRowExt } from '../all-wines/types';
import { useAllWines } from '../all-wines/hooks/useAllWines';
import { useIsMobile } from '../all-wines/hooks/useIsMobile';
import { useWineDelete } from '../all-wines/hooks/useWineDelete';
import { useWineEdit } from '../all-wines/hooks/useWineEdit';
import { useExcelExport } from '../all-wines/hooks/useExcelExport';
import { AllWinesToolbar } from '../all-wines/components/AllWinesToolbar';
import { WinesList } from '../all-wines/components/WinesList';
import { DetailContainer } from '../all-wines/components/DetailContainer';

export default function AllWinesTab() {
  const isMobile = useIsMobile();
  const list = useAllWines();
  const [selectedWine, setSelectedWine] = useState<WineRowExt | null>(null);

  const del = useWineDelete({
    onAfterDelete: list.fetchWines,
    onClearSelected: (ids) => {
      if (selectedWine && ids.includes(selectedWine.item_code)) setSelectedWine(null);
    },
  });

  const updateWineLocal = (id: string, patch: Partial<WineRowExt>) => {
    list.setWines(prev => prev.map(w => w.item_code === id ? { ...w, ...patch } as WineRowExt : w));
  };

  const edit = useWineEdit({ selectedWine, setSelectedWine, updateWineLocal });
  const xport = useExcelExport();

  // wines 갱신 시 selectedWine 동기화
  useEffect(() => {
    if (selectedWine) {
      const updated = list.wines.find(w => w.item_code === selectedWine.item_code);
      if (updated) setSelectedWine(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.wines]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <AllWinesToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        country={list.country}
        onCountryChange={list.setCountry}
        countries={list.countries}
        hideZero={list.hideZero}
        onToggleHideZero={() => list.setHideZero(h => !h)}
        total={list.total}
        checkedCount={del.checkedIds.size}
        deleting={del.deleting}
        onBatchDelete={del.handleBatchDelete}
        exporting={xport.exporting}
        onExport={() => xport.exportExcel({ search: list.search, country: list.country, hideZero: list.hideZero })}
      />

      <div style={{ display: 'flex', flex: 1, gap: isMobile ? 0 : 12, overflow: 'hidden', position: 'relative' }}>
        <WinesList
          wines={list.wines}
          loading={list.loading}
          isMobile={isMobile}
          selectedCode={selectedWine?.item_code}
          onSelect={setSelectedWine}
          deleting={del.deleting}
          onDelete={del.handleDeleteSingle}
          sortBy={list.sortBy}
          onSort={list.handleSort}
          sortArrow={list.sortArrow}
          page={list.page}
          totalPages={list.totalPages}
          onPageChange={list.setPage}
        />

        <DetailContainer
          isMobile={isMobile}
          selectedWine={selectedWine}
          onClose={() => setSelectedWine(null)}
          editFields={edit.editFields}
          setEditFields={edit.setEditFields}
          handleSaveField={edit.handleSaveField}
          savingField={edit.savingField}
          handleDeleteSingle={del.handleDeleteSingle}
          deleting={del.deleting}
          onRefresh={list.fetchWines}
        />
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
