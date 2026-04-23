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
          onBack={detail.backToList}
          onResearch={detail.handleResearch}
          onDelete={detail.handleDelete}
          onSave={detail.handleSave}
        />
      )}
      <Toast message={toast} />
    </>
  );
}
