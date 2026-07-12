'use client';

import { useEffect, useState } from 'react';

// 세일즈 와인리스트 출력 + 옵션(가격대별 최소재고) 계정별 저장.
// 저장은 /api/user/preferences (manager 계정 키). export는 저장값/현재값으로 필터.
const DEFAULT = { u20k: 120, u50k: 60, u100k: 24, u200k: 12, over: 1 };
const PREF_KEY = 'wineList.minStock';
const TIERS: [keyof typeof DEFAULT, string][] = [
  ['u20k', '~2만'], ['u50k', '~5만'], ['u100k', '~10만'], ['u200k', '~20만'], ['over', '20만+'],
];

const btn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-default)',
  background: 'transparent', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

export function WineListExportMenu() {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [minStock, setMinStock] = useState<Record<string, number>>(DEFAULT);

  // 계정에 저장된 설정 로드
  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/preferences')
      .then(r => r.json())
      .then(j => {
        const v = j?.preferences?.[PREF_KEY];
        if (!cancelled && v && typeof v === 'object') setMinStock({ ...DEFAULT, ...v });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ minStock: JSON.stringify(minStock) });
      const res = await fetch(`/api/sales/wines/export?${params}`);
      if (!res.ok) throw new Error('실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wine-list_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('와인리스트 다운로드에 실패했습니다.');
    } finally { setDownloading(false); }
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await fetch('/api/user/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: PREF_KEY, value: minStock }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert('설정 저장에 실패했습니다.'); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', gap: 6 }}>
      <button onClick={download} disabled={downloading} style={btn}>
        {downloading ? '...' : '와인리스트'}
      </button>
      <button onClick={() => setOpen(o => !o)} style={{ ...btn, color: open ? 'var(--action)' : 'var(--text-tertiary)' }}>
        옵션
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1000,
          background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 14, minWidth: 230,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            가격대별 최소재고 (미만 제외)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TIERS.map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {label}
                <input
                  type="number" min={0} value={minStock[k] || 0}
                  onChange={e => setMinStock(s => ({ ...s, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  style={{ width: 70, padding: '4px 6px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                />
              </label>
            ))}
          </div>
          <button onClick={save} disabled={saving} style={{
            marginTop: 10, width: '100%', padding: '7px', borderRadius: 6, border: 'none',
            background: saved ? 'var(--status-success)' : 'var(--action)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>저장하면 다른 기기에서도 유지돼요</div>
        </div>
      )}
    </div>
  );
}
