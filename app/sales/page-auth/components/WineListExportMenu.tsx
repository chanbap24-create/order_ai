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

  const [bookBusy, setBookBusy] = useState(false);
  const downloadBook = async () => {
    setBookBusy(true);
    try {
      const params = new URLSearchParams({ minStock: JSON.stringify(minStock) });
      const res = await fetch(`/api/sales/brand-book?${params}`);
      if (!res.ok) throw new Error('실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brandbook_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('브랜드북 생성에 실패했습니다.');
    } finally { setBookBusy(false); }
  };

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
      <button onClick={downloadBook} disabled={bookBusy} style={btn}
        title="출고 가능 재고 기준 브랜드북 PDF (브랜드 소개+병샷). 옵션의 최소재고 규칙 적용, 생성에 1~2분 걸릴 수 있어요">
        {bookBusy ? '생성 중…' : '브랜드북'}
      </button>
      {open && (
        <>
          {/* 데스크탑: 버튼 아래 드롭다운 / 모바일: 바텀시트(앵커 드롭다운은 화면 밖으로 잘림) */}
          <style>{`
            .wl-backdrop { display: none; }
            .wl-panel {
              position: absolute; top: calc(100% + 6px); right: 0; z-index: 1000;
              background: #fff; border: 1px solid var(--border-default); border-radius: 12px;
              box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 14px; min-width: 230px;
            }
            @media (max-width: 768px) {
              .wl-backdrop {
                display: block; position: fixed; inset: 0;
                background: rgba(0,0,0,0.35); z-index: 999;
              }
              .wl-panel {
                position: fixed; left: 0; right: 0; bottom: 0; top: auto;
                border-radius: 16px 16px 0 0; border: none;
                padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
                box-shadow: 0 -8px 24px rgba(0,0,0,0.15);
              }
              /* iOS 자동 확대 방지(16px 미만 입력 포커스 시 줌) */
              .wl-panel input { font-size: 16px !important; width: 88px !important; padding: 8px 6px !important; }
              .wl-panel label { font-size: 14px !important; padding: 2px 0; }
            }
          `}</style>
          <div className="wl-backdrop" onClick={() => setOpen(false)} />
          <div className="wl-panel">
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
              marginTop: 10, width: '100%', padding: '9px', borderRadius: 6, border: 'none',
              background: saved ? 'var(--status-success)' : 'var(--action)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>저장하면 다른 기기에서도 유지돼요</div>
          </div>
        </>
      )}
    </div>
  );
}
