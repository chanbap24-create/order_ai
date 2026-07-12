'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FlavorWine } from '@/app/lib/flavorTagsData';

const TYPE_COLOR: Record<string, string> = {
  '레드': '#8a2645', '화이트': '#9c7538', '스파클링': '#3f6b52',
  '로제': '#b5657f', '주정강화': '#6b4a2f', '스위트': '#6b4a2f',
};

export default function FlavorTagsTab() {
  const [wines, setWines] = useState<FlavorWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [flavorFilter, setFlavorFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/flavor-tags', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.wines) setWines(j.wines); else setErr(j.error || '조회 실패'); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const types = useMemo(() => [...new Set(wines.map((w) => w.type).filter(Boolean))], [wines]);
  const avgTags = wines.length ? (wines.reduce((s, w) => s + w.tags.length, 0) / wines.length).toFixed(1) : '0';

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return wines.filter((w) => {
      if (typeFilter && w.type !== typeFilter) return false;
      if (flavorFilter && !w.tags.includes(flavorFilter)) return false;
      if (ql) {
        const inName = (w.name || '').toLowerCase().includes(ql);
        const inTag = w.tags.some((t) => t.toLowerCase().includes(ql));
        if (!inName && !inTag) return false;
      }
      return true;
    });
  }, [wines, q, flavorFilter, typeFilter]);

  const pickFlavor = (f: string) => { setFlavorFilter(f); setQ(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const money = (n: number) => (n ? '₩' + n.toLocaleString('ko') : '');
  const ql = q.trim().toLowerCase();

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)' }}>불러오는 중…</div>;
  if (err) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--negative, #b23b4a)' }}>에러: {err}</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--surface, #fff)', paddingBottom: 10, borderBottom: '1px solid var(--neutral-200, #eee)' }}>
        <div style={{ fontSize: 13, color: 'var(--neutral-500)', margin: '0 0 8px' }}>
          {wines.length}종 · 평균 {avgTags}개 향미 · 향미 칩 클릭 = 그 향 가진 와인 필터
        </div>
        <input
          value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim()) setFlavorFilter(null); }}
          placeholder="와인명 또는 향미로 검색 (예: 샤블리, 부싯돌, 체리)"
          style={{ width: '100%', padding: '10px 13px', fontSize: 15, border: '1.5px solid var(--neutral-300, #ccc)', borderRadius: 9, background: 'var(--surface, #fff)', color: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9, alignItems: 'center' }}>
          {types.map((t) => (
            <span key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              style={{ fontSize: 12, padding: '4px 11px', borderRadius: 999, cursor: 'pointer', border: '1px solid var(--neutral-300,#ccc)',
                background: typeFilter === t ? 'var(--action, #6e1b33)' : 'transparent', color: typeFilter === t ? '#fff' : 'var(--neutral-600)' }}>
              {t}
            </span>
          ))}
          {flavorFilter && (
            <span style={{ fontSize: 12.5, color: 'var(--action,#6e1b33)', background: 'var(--action-muted,#f6eeee)', border: '1px solid var(--action-muted,#e8d5d5)', padding: '4px 10px', borderRadius: 999, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              향미: <b>{flavorFilter}</b>
              <span onClick={() => setFlavorFilter(null)} style={{ cursor: 'pointer', fontWeight: 700, opacity: 0.7 }}>✕</span>
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>
            {rows.length} / {wines.length}종
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {rows.length === 0 && <div style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: 50 }}>결과 없음</div>}
        {rows.map((w) => (
          <div key={w.code} style={{ background: 'var(--surface,#fff)', border: '1px solid var(--neutral-200,#eee)', borderRadius: 11, padding: '12px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 9 }}>
              {w.type && (
                <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[w.type] || 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[w.type] || 'var(--neutral-100)', flexShrink: 0 }} />
                  {w.type}
                </span>
              )}
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{w.name}</span>
              <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontFamily: 'monospace' }}>{w.code}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{money(w.price)} · 향 {w.tags.length}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {w.tags.map((t, i) => {
                const hit = (ql && t.toLowerCase().includes(ql)) || flavorFilter === t;
                return (
                  <span key={i} onClick={() => pickFlavor(t)}
                    style={{ fontSize: 12, padding: '2.5px 9px', borderRadius: 999, cursor: 'pointer',
                      background: hit ? 'var(--action,#6e1b33)' : 'var(--action-muted,#f6eeee)',
                      color: hit ? '#fff' : 'var(--action,#7a2740)', border: '1px solid var(--action-muted,#e8d5d5)' }}>
                    {t}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
