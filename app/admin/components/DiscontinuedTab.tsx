'use client';

// 단종 관리 — 브랜드 단위. 전체 브랜드 목록에서 선택해 단종 설정/해제.
// 단종 브랜드의 품목은 인벤토리 검색 결과에 '단종' 표시.
import { useEffect, useMemo, useState } from 'react';

type BrandRow = {
  brand_code: string;
  name: string;
  name_en: string;
  discontinued: boolean;
  wine_count: number;
};

export default function DiscontinuedTab() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/discontinued').then((r) => r.json())
      .then((j) => setBrands(Array.isArray(j.brands) ? j.brands : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (b: BrandRow) => {
    const next = !b.discontinued;
    if (!confirm(next
      ? `'${b.name}' 브랜드를 단종 처리할까요?\n(${b.wine_count}개 품목이 인벤토리 검색에서 단종으로 표시됩니다)`
      : `'${b.name}' 브랜드 단종을 해제할까요?`)) return;
    setBusy(b.brand_code);
    try {
      const r = await fetch('/api/admin/discontinued', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandCode: b.brand_code, discontinued: next }),
      });
      if (!r.ok) throw new Error();
      setBrands((prev) => prev.map((x) =>
        x.brand_code === b.brand_code ? { ...x, discontinued: next } : x));
    } catch {
      alert('처리에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => brands.filter((b) => !q
    || b.name.toLowerCase().includes(q)
    || b.name_en.toLowerCase().includes(q)
    || b.brand_code.toLowerCase().includes(q)), [brands, q]);
  const discCount = brands.filter((b) => b.discontinued).length;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="브랜드명 · 코드 검색"
          style={{
            flex: '1 1 260px', border: '1px solid var(--border-default)', borderRadius: 8,
            padding: '9px 12px', fontSize: 14, background: 'var(--surface)', outline: 'none',
          }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          전체 {brands.length} · 단종 <b style={{ color: 'var(--status-danger)' }}>{discCount}</b>
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        브랜드를 단종 처리하면 그 브랜드의 모든 품목이 인벤토리 검색에서
        <b style={{ color: 'var(--status-danger)' }}> 단종</b>으로 표시됩니다. (단종 브랜드가 목록 맨 위)
      </div>

      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>}

      {shown.map((b) => (
        <div key={b.brand_code} style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 4px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', width: 30 }}>
            {b.brand_code}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</span>
          {b.name_en && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.name_en}</span>}
          {b.discontinued && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-danger)' }}>단종</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {b.wine_count}개 품목
          </span>
          <button onClick={() => toggle(b)} disabled={busy === b.brand_code}
            style={{
              border: '1px solid var(--border-default)', borderRadius: 8, padding: '5px 12px',
              fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
              background: b.discontinued ? 'var(--surface)' : 'var(--action)',
              color: b.discontinued ? 'var(--text-secondary)' : 'var(--text-on-primary)',
              borderColor: b.discontinued ? 'var(--border-default)' : 'var(--action)',
              opacity: busy === b.brand_code ? 0.5 : 1,
            }}>
            {busy === b.brand_code ? '처리 중…' : b.discontinued ? '단종 해제' : '단종 처리'}
          </button>
        </div>
      ))}
    </div>
  );
}
