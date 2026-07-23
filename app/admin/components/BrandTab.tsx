'use client';

import { useState } from 'react';
import { useBrands } from '../brand/hooks/useBrands';
import { useBrandDetail } from '../brand/hooks/useBrandDetail';
import { BrandListView } from '../brand/components/BrandListView';
import { BrandDetailView } from '../brand/components/BrandDetailView';
import { Toast } from '../brand/components/FormPrimitives';

export default function BrandTab() {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const list = useBrands();
  const detail = useBrandDetail({
    onListReload: list.loadBrands,
    showToast,
  });

  // 테이스팅 노트의 와이너리 소개로 미등록·소개 빈 브랜드 일괄 보강
  const [syncingNotes, setSyncingNotes] = useState(false);
  const handleNoteSync = async () => {
    if (syncingNotes) return;
    setSyncingNotes(true);
    try {
      const r = await fetch('/api/admin/brands/sync-from-notes', { method: 'POST' });
      const j = await r.json();
      if (j.success) {
        showToast(j.count > 0 ? `노트에서 ${j.count}개 브랜드 보강: ${j.synced.join(', ')}` : '보강할 브랜드가 없습니다');
        if (j.count > 0) list.loadBrands();
      } else showToast(j.error || '동기화에 실패했습니다');
    } catch {
      showToast('동기화에 실패했습니다');
    } finally {
      setSyncingNotes(false);
    }
  };

  return (
    <>
      {detail.viewMode === 'list' ? (
        <BrandListView
          brands={list.brands}
          loading={list.loading}
          searchQuery={list.searchQuery}
          setSearchQuery={list.setSearchQuery}
          countryFilter={list.countryFilter}
          setCountryFilter={list.setCountryFilter}
          countries={list.countries}
          onSelect={detail.openDetail}
          onNew={detail.openNew}
          onNoteSync={handleNoteSync}
          syncingNotes={syncingNotes}
        />
      ) : (
        <BrandDetailView
          editForm={detail.editForm}
          updateField={detail.updateField}
          isNew={detail.isNew}
          selectedBrand={detail.selectedBrand}
          linkedWines={detail.linkedWines}
          validation={detail.validation}
          saving={detail.saving}
          researching={detail.researching}
          extractingLogo={detail.extractingLogo}
          uploading={detail.uploading}
          onBack={detail.backToList}
          onResearch={detail.handleResearch}
          onExtractLogo={detail.handleExtractLogo}
          onUploadFile={detail.handleUploadFile}
          onDelete={detail.handleDelete}
          onSave={detail.handleSave}
        />
      )}
      <Toast message={toast} />
    </>
  );
}
