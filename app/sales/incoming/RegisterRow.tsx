'use client';

// 입항품목 대기 거래처 등록 인라인 폼 — 거래처 검색(자동완성) + 메모
import { useEffect, useState } from 'react';

type Suggestion = { client_code: string; client_name: string };

export function RegisterRow({ itemCode, itemName, onDone }: {
  itemCode: string;
  itemName: string;
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (picked || query.trim().length < 1) { setSugs([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/sales/clients?search=${encodeURIComponent(query)}&limit=8&type=wine`);
        const j = await r.json();
        setSugs(Array.isArray(j.clients) ? j.clients : []);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [query, picked]);

  const save = async () => {
    const clientName = picked?.client_name || query.trim();
    if (!clientName || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/sales/incoming', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemCode, itemName,
          clientCode: picked?.client_code || null,
          clientName, memo: memo.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error();
      onDone();
    } catch {
      alert('등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const input = {
    border: '1px solid var(--border-default)', borderRadius: 8, padding: '7px 10px',
    fontSize: 13, background: 'var(--surface)', outline: 'none',
  } as const;

  return (
    <div style={{ marginTop: 10, position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <input value={picked ? picked.client_name : query} placeholder="거래처 검색"
            onChange={(e) => { setPicked(null); setQuery(e.target.value); }}
            style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
          {sugs.length > 0 && !picked && (
            /* 표 래퍼의 overflow에 잘리지 않게 — 떠 있는 드롭다운 대신 흐름 배치(펼침 행이 늘어남) */
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-default)',
              borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
            }}>
              {sugs.map((s) => (
                <button key={s.client_code} onClick={() => { setPicked(s); setSugs([]); }}
                  style={{
                    all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px', fontSize: 13, cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                  {s.client_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)"
          style={{ ...input, flex: '1 1 140px' }} maxLength={200} />
        <button onClick={save} disabled={busy || !(picked || query.trim())}
          style={{
            border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600,
            background: 'var(--action)', color: 'var(--text-on-primary)', cursor: 'pointer',
            opacity: busy || !(picked || query.trim()) ? 0.5 : 1,
          }}>
          {busy ? '등록 중…' : '등록'}
        </button>
      </div>
    </div>
  );
}
