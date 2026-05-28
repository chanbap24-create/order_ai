'use client';

/**
 * Admin 탭 — 글라스 이미지/스펙 관리.
 * 시리즈(앞 4자리) 별 collapsible 섹션 + 스펙 인라인 편집.
 */

import { useEffect, useMemo, useState } from 'react';

export type Spec = {
  item_no: string;
  glass_code: string | null;
  series: string | null;
  description: string | null;
  height_cm: number | null;
  capacity_ml: number | null;
  image_url: string | null;
  updated_at: string | null;
};

function seriesPrefix(code: string | null): string {
  if (!code) return '기타';
  const first = code.split('/')[0];
  return first.padStart(4, '0');
}

export default function GlassImagesTab() {
  const [items, setItems] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
  useEffect(() => { reload(); }, []);

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

  // 시리즈별 그룹핑 (prefix 4자리)
  const groups = useMemo(() => {
    const map = new Map<string, Spec[]>();
    for (const it of filtered) {
      const p = seriesPrefix(it.glass_code);
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(it);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, arr]) => ({
        prefix,
        items: arr.sort((x, y) => (x.glass_code || '').localeCompare(y.glass_code || '')),
        // 대표 시리즈명
        seriesName: arr.find((x) => x.series)?.series || '',
        withImg: arr.filter((x) => x.image_url).length,
      }));
  }, [filtered]);

  const stats = useMemo(() => {
    const total = items.length;
    const withImg = items.filter((i) => i.image_url).length;
    return { total, withImg, without: total - withImg };
  }, [items]);

  async function uploadFile(itemNo: string, file: File) {
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
      flash(`✓ ${itemNo} 이미지 업로드`);
    } catch (e) {
      flash(`✗ ${e instanceof Error ? e.message : '오류'}`);
    }
  }

  async function removeImage(itemNo: string) {
    if (!confirm(`${itemNo} 이미지를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/glass-images?item_no=${encodeURIComponent(itemNo)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '삭제 실패');
      setItems((prev) => prev.map((i) => (i.item_no === itemNo ? { ...i, image_url: null } : i)));
      flash(`✓ ${itemNo} 삭제`);
    } catch (e) {
      flash(`✗ ${e instanceof Error ? e.message : '오류'}`);
    }
  }

  async function patchSpec(itemNo: string, body: Partial<Spec>) {
    try {
      const res = await fetch(`/api/admin/glass-images?item_no=${encodeURIComponent(itemNo)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '저장 실패');
      setItems((prev) => prev.map((i) => (i.item_no === itemNo ? { ...i, ...body } as Spec : i)));
      flash(`✓ ${itemNo} 저장`);
    } catch (e) {
      flash(`✗ ${e instanceof Error ? e.message : '오류'}`);
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>로딩 중...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          글라스 이미지 ({stats.total}개)
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          이미지 있음 {stats.withImg} · 없음 {stats.without}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 16px',
          background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13, zIndex: 100,
        }}>{toast}</div>
      )}

      {/* 시리즈 섹션들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g) => {
          const isCollapsed = collapsed[g.prefix];
          return (
            <section key={g.prefix} style={{
              background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10,
            }}>
              <header
                onClick={() => setCollapsed((p) => ({ ...p, [g.prefix]: !p[g.prefix] }))}
                style={{
                  cursor: 'pointer', padding: '10px 14px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isCollapsed ? '▶' : '▼'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--action)' }}>{g.prefix}</span>
                  {g.seriesName && <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{g.seriesName}</span>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {g.items.length}개 · 이미지 {g.withImg}/{g.items.length}
                </span>
              </header>
              {!isCollapsed && (
                <div style={{
                  padding: 14,
                  display: 'grid', gap: 12,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                }}>
                  {g.items.map((it) => (
                    <SpecCard
                      key={it.item_no}
                      item={it}
                      onUpload={(f) => uploadFile(it.item_no, f)}
                      onRemove={() => removeImage(it.item_no)}
                      onPatch={(b) => patchSpec(it.item_no, b)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>결과 없음</div>
      )}
    </div>
  );
}

function SpecCard({
  item, onUpload, onRemove, onPatch,
}: {
  item: Spec;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onPatch: (body: Partial<Spec>) => void;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <label
        htmlFor={`file-${item.item_no}`}
        style={{
          position: 'relative', height: 140, background: '#f8f7f5', borderRadius: 6,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', border: '1px dashed var(--border-default)',
        }}
      >
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.description || item.item_no}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+ 클릭하여 업로드</span>
        )}
      </label>
      <input
        id={`file-${item.item_no}`} type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />

      <div style={{ fontSize: 11, color: 'var(--action)', fontWeight: 700 }}>{item.glass_code || '-'}</div>

      <EditableField
        label="이름"
        value={item.description || ''}
        onSave={(v) => onPatch({ description: v })}
      />
      <EditableField
        label="시리즈"
        value={item.series || ''}
        onSave={(v) => onPatch({ series: v })}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <EditableField
          label="높이(cm)"
          value={item.height_cm != null ? String(item.height_cm) : ''}
          type="number"
          onSave={(v) => onPatch({ height_cm: v === '' ? null : Number(v) })}
        />
        <EditableField
          label="용량(ml)"
          value={item.capacity_ml != null ? String(item.capacity_ml) : ''}
          type="number"
          onSave={(v) => onPatch({ capacity_ml: v === '' ? null : Number(v) })}
        />
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.item_no}</div>

      {item.image_url && (
        <button
          onClick={onRemove}
          style={{
            height: 24, padding: '0 8px', borderRadius: 4,
            border: '1px solid var(--border-default)', background: 'var(--surface)',
            color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
          }}
        >이미지 삭제</button>
      )}
    </div>
  );
}

/** 인라인 편집 필드 — blur/Enter 에 저장 */
function EditableField({
  label, value, type = 'text', onSave,
}: {
  label: string;
  value: string;
  type?: 'text' | 'number';
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  const dirty = v !== value;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (dirty) onSave(v); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { setV(value); e.currentTarget.blur(); }
        }}
        style={{
          height: 26, padding: '0 6px', borderRadius: 4,
          border: `1px solid ${dirty ? 'var(--action)' : 'var(--border-subtle)'}`,
          background: dirty ? 'rgba(90,21,21,0.04)' : 'var(--surface)',
          fontSize: 12, color: 'var(--text-primary)', outline: 'none', minWidth: 0, width: '100%',
        }}
      />
    </label>
  );
}
