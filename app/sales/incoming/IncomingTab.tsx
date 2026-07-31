'use client';

// 입항품목 — 입고 예정(입항·통관 전) 와인 목록 + 기다리는 거래처 등록.
// 통관 완료되면 세일즈 접속 시 담당자에게 팝업으로 알림.
import { useCallback, useEffect, useState } from 'react';
import { Section, Stack } from '@/app/components/ui';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
import type { IncomingItem } from '@/app/lib/incomingRequests';
import { RegisterRow } from './RegisterRow';

const STATUS_COLOR: Record<IncomingItem['status'], string> = {
  '입고 예정': 'var(--text-tertiary)',
  '통관 대기': 'var(--status-warning)',
  '통관 완료': 'var(--status-success)',
};

const fmtDate = (d: string | null) => (d ? `${d.slice(5, 7)}/${d.slice(8, 10)} 입항` : '');

export default function IncomingTab() {
  const [items, setItems] = useState<IncomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFor, setOpenFor] = useState<string | null>(null); // 등록 입력 연 품목
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/sales/incoming');
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const removeReq = async (id: number) => {
    if (!confirm('이 거래처의 대기 등록을 해제할까요?')) return;
    const r = await fetch('/api/sales/incoming', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    });
    if (r.ok) void load();
  };

  const q = search.trim().toLowerCase();
  const shown = items
    .filter((i) => !waitingOnly || i.requests.length > 0)
    .filter((i) => !q
      || i.item_name.toLowerCase().includes(q)
      || i.item_code.toLowerCase().includes(q)
      || i.requests.some((r) => r.client_name.toLowerCase().includes(q)));

  return (
    <Stack gap={16}>
      <Section title="입항품목" meta={`${shown.length}개`} padding="none">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="품명 · 품번 · 거래처 검색"
            style={{
              flex: '1 1 220px', border: '1px solid var(--border-default)', borderRadius: 8,
              padding: '7px 10px', fontSize: 13, background: 'var(--surface)', outline: 'none',
            }} />
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={waitingOnly} onChange={(e) => setWaitingOnly(e.target.checked)}
              style={{ accentColor: 'var(--action)' }} />
            대기 있는 품목만
          </label>
        </div>

        {loading && <div style={{ padding: 14 }}><ListSkeleton rows={8} /></div>}
        {!loading && shown.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            표시할 입고 예정 품목이 없습니다
          </div>
        )}

        {shown.map((it) => (
          <div key={it.item_code} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '11px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{it.item_name}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{it.item_code}</span>
              <span style={{ fontSize: 12, color: STATUS_COLOR[it.status] }}>{it.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {fmtDate(it.arrival_date)}
                {it.incoming > 0 && ` · 예정 ${it.incoming}`}
                {it.bonded > 0 && ` · 보세 ${it.bonded}`}
                {it.available > 0 && ` · 가용 ${it.available}`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {it.requests.map((r) => (
                <span key={r.id}
                  title={`담당 ${r.manager}${r.registered_by && r.registered_by !== r.manager ? ` · ${r.registered_by} 등록` : ''}${r.memo ? ` · ${r.memo}` : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                  <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-info)' }} />
                  {r.client_name}
                  <button onClick={() => removeReq(r.id)} aria-label="대기 해제"
                    style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '0 2px' }}>×</button>
                </span>
              ))}
              <button onClick={() => setOpenFor(openFor === it.item_code ? null : it.item_code)}
                style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: 'var(--action)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {openFor === it.item_code ? '닫기' : '+ 거래처 등록'}
              </button>
            </div>

            {openFor === it.item_code && (
              <RegisterRow itemCode={it.item_code} itemName={it.item_name}
                onDone={() => { setOpenFor(null); void load(); }} />
            )}
          </div>
        ))}
      </Section>
    </Stack>
  );
}
