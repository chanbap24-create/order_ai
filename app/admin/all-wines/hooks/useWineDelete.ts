'use client';

import { useState } from 'react';

type Args = {
  onAfterDelete: () => void;
  onClearSelected: (idsInvalidated: string[]) => void;
};

export function useWineDelete({ onAfterDelete, onClearSelected }: Args) {
  const [deleting, setDeleting] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllChecks = (allIds: string[]) => {
    if (checkedIds.size === allIds.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(allIds));
  };

  const handleDeleteSingle = async (id: string, name: string) => {
    if (!confirm(`정말 삭제하시겠습니까?\n\n"${name}" (${id})\n\n관련 테이스팅 노트, 이미지도 함께 삭제됩니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/wines/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const next = new Set(checkedIds);
        next.delete(id);
        setCheckedIds(next);
        onClearSelected([id]);
        onAfterDelete();
      } else {
        alert(`삭제 실패: ${data.error}`);
      }
    } catch (e) {
      alert(`삭제 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setDeleting(false);
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) { alert('삭제할 와인을 선택하세요.'); return; }
    if (!confirm(`정말 ${ids.length}개 와인을 삭제하시겠습니까?\n\n관련 테이스팅 노트, 이미지도 함께 삭제됩니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/wines/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: ids }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.deleted}개 삭제 완료`);
        setCheckedIds(new Set());
        onClearSelected(ids);
        onAfterDelete();
      } else {
        alert(`삭제 실패: ${data.error}`);
      }
    } catch (e) {
      alert(`삭제 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setDeleting(false);
  };

  return {
    deleting, checkedIds, setCheckedIds,
    toggleCheck, toggleAllChecks,
    handleDeleteSingle, handleBatchDelete,
  };
}
