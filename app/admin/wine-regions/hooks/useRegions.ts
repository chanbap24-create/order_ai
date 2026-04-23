'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WineRegion } from '../types';

export function useRegions(onToast: (msg: string) => void) {
  const [regions, setRegions] = useState<WineRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wine-regions');
      const data = await res.json();
      if (Array.isArray(data)) setRegions(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async (item: WineRegion, isNew: boolean): Promise<boolean> => {
    if (!item.country.trim()) { onToast('국가는 필수입니다'); return false; }
    if (!item.major_region.trim()) { onToast('대지역은 필수입니다'); return false; }
    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const body = isNew ? { ...item, id: undefined } : item;
      const res = await fetch('/api/wine-regions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onToast(isNew ? '추가 완료' : '수정 완료');
        fetchData();
        return true;
      }
      const err = await res.json();
      onToast(err.error || '저장 실패');
      return false;
    } catch {
      onToast('저장 실패');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/wine-regions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        onToast('삭제 완료');
        fetchData();
      }
    } catch {
      onToast('삭제 실패');
    }
  };

  return { regions, loading, saving, fetchData, save, remove };
}
