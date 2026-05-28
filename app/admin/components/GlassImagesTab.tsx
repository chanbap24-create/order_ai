'use client';

/**
 * Admin 탭 — 글라스 이미지 관리.
 * glass_specs 목록 조회 + 품번별 이미지 업로드/삭제.
 */

import { useEffect, useMemo, useState } from 'react';

type Spec = {
  item_no: string;
  glass_code: string | null;
  series: string | null;
  description: string | null;
  height_cm: number | null;
  capacity_ml: number | null;
  image_url: string | null;
  updated_at: string | null;
};

export default function GlassImagesTab() {
  const [items, setItems] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/glass-images');
      const json = await res.json();
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === 'with' && !it.image_url) return false;
      if (filter === 'without' && it.image_url) return false;
      if (!term) return true;
      const blob = `${it.item_no} ${it.glass_code || ''} ${it.series || ''} ${it.description || ''}`.toLowerCase();
      return blob.includes(term);
    });
  }, [items, search, filter]);

  const stats = useMemo(() => {
    const total = items.length;
    const withImg = items.filter((i) => i.image_url).length;
    return { total, withImg, without: total - withImg };
  }, [items]);

  async function uploadFile(itemNo: string, file: File) {
    setUploading(itemNo);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch(`/api/admin/glass-images?item_no=${encodeURIComponent(itemNo)}`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '업로드 실패');
      setItems((prev) => prev.map((i) => (i.item_no === itemNo ? { ...i, image_url: json.image_url } : i)));
      setToast(`✓ ${itemNo} 업로드 완료`);
      setTimeout(() => setToast(''), 2000);
    } catch (e) {
      setToast(`✗ ${e instanceof Error ? e.message : '오류'}`);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setUploading(null);
    }
  }

  async function removeImage(itemNo: string) {
    if (!confirm(`${itemNo} 이미지를 삭제하시겠습니까?`)) return;
    setUploading(itemNo);
    try {
      const res = await fetch(`/api/admin/glass-images?item_no=${encodeURIComponent(itemNo)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '삭제 실패');
      setItems((prev) => prev.map((i) => (i.item_no === itemNo ? { ...i, image_url: null } : i)));
      setToast(`✓ ${itemNo} 삭제 완료`);
      setTimeout(() => setToast(''), 2000);
    } catch (e) {
      setToast(`✗ ${e instanceof Error ? e.message : '오류'}`);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>로딩 중...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          글라스 이미지 ({stats.total}개)
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          이미지 있음 {stats.withImg} · 없음 {stats.without}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['all', 'with', 'without'] as const).map((k) => {
            const labels = { all: '전체', with: '이미지 있음', without: '이미지 없음' };
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  height: 28, padding: '0 12px', borderRadius: 6,
                  border: `1px solid ${filter === k ? 'var(--action)' : 'var(--border-default)'}`,
                  background: filter === k ? 'var(--action)' : 'var(--surface)',
                  color: filter === k ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >{labels[k]}</button>
            );
          })}
          <input
            placeholder="품번/코드/시리즈 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12,
              border: '1px solid var(--border-default)', background: 'var(--surface)', minWidth: 200,
            }}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 16px',
          background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13, zIndex: 100,
        }}>{toast}</div>
      )}

      {/* Grid */}
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      }}>
        {filtered.map((it) => (
          <div key={it.item_no} style={{
            background: 'var(--surface)', border: '1px solid var(--border-default)',
            borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* Image preview */}
            <label
              htmlFor={`file-${it.item_no}`}
              style={{
                position: 'relative', height: 160, background: '#f8f7f5',
                borderRadius: 6, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '1px dashed var(--border-default)',
              }}
            >
              {it.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.image_url}
                  alt={it.description || it.item_no}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+ 클릭하여 업로드</span>
              )}
              {uploading === it.item_no && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, color: 'var(--action)',
                }}>처리 중...</div>
              )}
            </label>
            <input
              id={`file-${it.item_no}`}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(it.item_no, f);
                e.target.value = '';
              }}
            />

            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 11, color: 'var(--action)', fontWeight: 700 }}>
                {it.glass_code || '-'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {it.description || it.series || it.item_no}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {it.series || '-'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {it.item_no}
                {it.height_cm && ` · H: ${it.height_cm}cm`}
                {it.capacity_ml && ` · C: ${it.capacity_ml}ml`}
              </div>
            </div>

            {it.image_url && (
              <button
                onClick={() => removeImage(it.item_no)}
                style={{
                  height: 24, padding: '0 8px', borderRadius: 4,
                  border: '1px solid var(--border-default)', background: 'var(--surface)',
                  color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
                }}
              >이미지 삭제</button>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          결과 없음
        </div>
      )}
    </div>
  );
}
