'use client';

import { useEffect, useState, useCallback } from 'react';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import type { Wine, TastingNote } from '@/app/types/wine';

export default function TastingNoteTab() {
  const [wines, setWines] = useState<(Wine & { tasting_note_id: number | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterNote, setFilterNote] = useState<'all' | 'with' | 'without'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TastingNote>>({});
  const [generating, setGenerating] = useState<Set<string>>(new Set());

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterNote === 'with') params.set('hasNote', 'true');
    else if (filterNote === 'without') params.set('hasNote', 'false');
    try {
      const res = await fetch(`/api/admin/tasting-notes?${params}`);
      const data = await res.json();
      if (data.success) setWines(data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, filterNote]);

  useEffect(() => { fetchWines(); }, [fetchWines]);

  const handleEdit = async (wine: Wine) => {
    setEditingId(wine.item_code);
    try {
      const res = await fetch(`/api/admin/wines/${wine.item_code}`);
      const data = await res.json();
      if (data.success && data.data.tastingNote) {
        setEditForm(data.data.tastingNote);
      } else {
        setEditForm({});
      }
    } catch {
      setEditForm({});
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await fetch('/api/admin/tasting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineId: editingId, ...editForm }),
      });
      setEditingId(null);
      setEditForm({});
      fetchWines();
    } catch { /* ignore */ }
  };

  const handleGeneratePpt = async (wineId: string) => {
    setGenerating((prev) => new Set(prev).add(wineId));
    try {
      const res = await fetch('/api/admin/tasting-notes/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: [wineId] }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasting-note-${wineId}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
        fetchWines();
      }
    } catch { /* ignore */ }
    setGenerating((prev) => { const s = new Set(prev); s.delete(wineId); return s; });
  };

  const handleBulkPpt = async () => {
    const withNotes = wines.filter((w) => w.tasting_note_id);
    if (withNotes.length === 0) return;
    setGenerating(new Set(withNotes.map((w) => w.item_code)));
    try {
      const res = await fetch('/api/admin/tasting-notes/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: withNotes.map((w) => w.item_code) }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasting-notes-bulk.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
    setGenerating(new Set());
  };

  const noteFields = [
    { key: 'color_note', label: '색상 (Color)' },
    { key: 'nose_note', label: '향 (Nose)' },
    { key: 'palate_note', label: '맛 (Palate)' },
    { key: 'food_pairing', label: '음식 페어링' },
    { key: 'glass_pairing', label: '추천 글라스' },
    { key: 'serving_temp', label: '서빙 온도' },
    { key: 'winemaking', label: '양조 방법' },
    { key: 'awards', label: '수상내역' },
  ];

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {['all', 'with', 'without'].map((f) => (
            <button key={f} className={`btn btn-sm ${filterNote === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilterNote(f as typeof filterNote)}>
              {f === 'all' ? '전체' : f === 'with' ? '작성완료' : '미작성'}
            </button>
          ))}
          <input className="input" style={{ width: 220, padding: 'var(--space-2) var(--space-3)' }} placeholder="와인명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleBulkPpt}>일괄 PPT 생성</button>
      </div>

      {/* 편집 폼 */}
      {editingId && (
        <Card style={{ marginBottom: 'var(--space-4)', border: '2px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>테이스팅 노트 편집 - {editingId}</h3>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>저장</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditForm({}); }}>취소</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-3)' }}>
            {noteFields.map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-light)', display: 'block', marginBottom: 2 }}>{f.label}</label>
                <textarea
                  className="input"
                  style={{ minHeight: 60, resize: 'vertical' }}
                  value={(editForm as Record<string, string>)[f.key] || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 와인 목록 */}
      <Card style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-light)' }}>로딩 중...</div>
        ) : wines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-lighter)' }}>와인 데이터가 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>품번</th>
                <th style={thStyle}>품명</th>
                <th style={thStyle}>국가</th>
                <th style={thStyle}>노트</th>
                <th style={thStyle}>작업</th>
              </tr>
            </thead>
            <tbody>
              {wines.map((w) => (
                <tr key={w.item_code} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={tdStyle}><code style={{ fontSize: 'var(--text-xs)' }}>{w.item_code}</code></td>
                  <td style={tdStyle}>{w.item_name_kr}{w.item_name_en && <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{w.item_name_en}</span>}</td>
                  <td style={tdStyle}>{w.country || w.country_en || '-'}</td>
                  <td style={tdStyle}>
                    <Badge variant={w.tasting_note_id ? 'success' : 'outline'}>
                      {w.tasting_note_id ? '완료' : '미작성'}
                    </Badge>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      <button className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleEdit(w)}>
                        편집
                      </button>
                      {w.tasting_note_id && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleGeneratePpt(w.item_code)}
                          disabled={generating.has(w.item_code)}
                        >
                          {generating.has(w.item_code) ? '생성중...' : 'PPT'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-3) var(--space-2)', fontWeight: 600, color: 'var(--color-text-light)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-2)', verticalAlign: 'middle' };
