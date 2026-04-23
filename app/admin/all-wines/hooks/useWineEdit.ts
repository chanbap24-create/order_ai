'use client';

import { useEffect, useState } from 'react';
import type { WineRowExt } from '../types';

type Args = {
  selectedWine: WineRowExt | null;
  setSelectedWine: (w: WineRowExt | null) => void;
  updateWineLocal: (id: string, patch: Partial<WineRowExt>) => void;
};

export function useWineEdit({ selectedWine, setSelectedWine, updateWineLocal }: Args) {
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState('');

  useEffect(() => {
    if (selectedWine) {
      setEditFields({
        supplier: selectedWine.supplier || '',
        item_name_en: selectedWine.item_name_en || '',
        country_en: selectedWine.country_en || '',
        region: selectedWine.region || '',
        grape_varieties: selectedWine.grape_varieties || '',
        wine_type: selectedWine.wine_type || '',
      });
    }
  }, [selectedWine]);

  const handleSaveField = async (dbKey: string) => {
    if (!selectedWine) return;
    const trimmed = (editFields[dbKey] || '').trim();
    const original = (selectedWine as unknown as Record<string, unknown>)[dbKey] || '';
    if (trimmed === original) return;
    setSavingField(dbKey);
    try {
      const res = await fetch(`/api/admin/wines/${selectedWine.item_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine: { [dbKey]: trimmed || null } }),
      });
      const data = await res.json();
      if (data.success) {
        const patch = { [dbKey]: trimmed || null } as Partial<WineRowExt>;
        setSelectedWine({ ...selectedWine, ...patch });
        updateWineLocal(selectedWine.item_code, patch);
      } else {
        alert(`저장 실패: ${data.error}`);
      }
    } catch (e) {
      alert(`저장 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setSavingField('');
  };

  return { editFields, setEditFields, savingField, handleSaveField };
}
