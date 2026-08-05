'use client';

// 단종 관리 — 와인 검색 후 단종 설정/해제 (wines.status). 인벤토리 검색 결과의 '단종' 표시와 연동.
import { useEffect, useState } from 'react';

type Row = {
  item_code: string;
  item_name_kr: string;
  item_name_en: string | null;
  brand: string | null;
  status: string;
  available_stock: number | null;
};

export default function DiscontinuedTab() {
  const [search, setSearch] = useState('');
  const [onlyDisc, setOnlyDisc] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim() && !onlyDisc) { setRows([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (onlyDisc) params.set('discontinued', '1');
        const r = await fetch(`/api/admin/discontinued?${params}`);
        const j = await r.json();
        setRows(Array.isArray(j.wines) ? j.wines : []);
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, onlyDisc]);

  const toggle = async (w: Row) => {
    const next = w.status !== 'discontinued';
    if (!confirm(next ? `'${w.item_name_kr}'을(를) 단종 처리할까요?` : `'${w.item_name_kr}' 단종을 해제할까요?`)) return;
    setBusy(w.item_code);
    try {
      const r = await fetch('/api/admin/discontinued', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCode: w.item_code, discontinued: next }),
      });
      if (!r.ok) throw new Error();
      setRows((prev) => prev.map((x) =>
        x.item_code === w.item_code ? { ...x, status: next ? 'discontinued' : 'active' } : x));
    } catch {
      alert('처리에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="품명 · 품번 검색"
          style={{
            flex: '1 1 260px', border: '1px solid var(--border-default)', borderRadius: 8,
            padding: '9px 12px', fontSize: 14, background: 'var(--surface)', outline: 'none',
          }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={onlyDisc} onChange={(e) => setOnlyDisc(e.target.checked)}
            style={{ accentColor: 'var(--action)' }} />
          단종만 보기
        </label>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
        단종 처리하면 인벤토리 검색 결과에 <b style={{ color: 'var(--status-danger)' }}>단종</b> 표시가 붙습니다. (와인리스트·가격리스트에서도 제외)
      </div>

      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>검색 중…</div>}
      {!loading && rows.length === 0 && (search.trim() || onlyDisc) && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>결과가 없습니다</div>
      )}

      {rows.map((w) => {
        const disc = w.status === 'discontinued';
        return (
          <div key={w.item_code} style={{
            display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 4px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{w.item_name_kr}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{w.item_code}</span>
            {disc && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-danger)' }}>단종</span>}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              재고 {w.available_stock ?? 0}
            </span>
            <button onClick={() => toggle(w)} disabled={busy === w.item_code}
              style={{
                border: '1px solid var(--border-default)', borderRadius: 8, padding: '5px 12px',
                fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
                background: disc ? 'var(--surface)' : 'var(--action)',
                color: disc ? 'var(--text-secondary)' : 'var(--text-on-primary)',
                borderColor: disc ? 'var(--border-default)' : 'var(--action)',
                opacity: busy === w.item_code ? 0.5 : 1,
              }}>
              {busy === w.item_code ? '처리 중…' : disc ? '단종 해제' : '단종 처리'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
