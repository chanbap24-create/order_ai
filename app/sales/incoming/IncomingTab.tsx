'use client';

// 입항품목 — 입고 예정(입항·통관 전) 와인 테이블 + 기다리는 거래처 등록.
// 통관 완료되면 세일즈 접속 시 담당자에게 팝업으로 알림.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Section, Stack } from '@/app/components/ui';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
import type { IncomingItem } from '@/app/lib/incomingRequests';
import { RegisterRow } from './RegisterRow';

const STATUS_COLOR: Record<IncomingItem['status'], string> = {
  '입고 예정': 'var(--text-tertiary)',
  '통관 대기': 'var(--status-warning)',
  '통관 완료': 'var(--status-success)',
};
const STATUS_ORDER: Record<IncomingItem['status'], number> = {
  '입고 예정': 0, '통관 대기': 1, '통관 완료': 2,
};

type SortKey = 'item_name' | 'status' | 'arrival_date' | 'incoming' | 'bonded' | 'available';
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' | 'center' }[] = [
  { key: 'item_name', label: '품명', align: 'left' },
  { key: 'status', label: '상태', align: 'center' },
  { key: 'arrival_date', label: '입항일', align: 'right' },
  { key: 'incoming', label: '예정', align: 'right' },
  { key: 'bonded', label: '보세', align: 'right' },
  { key: 'available', label: '가용', align: 'right' },
];

const th: CSSProperties = {
  padding: '9px 10px', fontSize: 11.5, fontWeight: 500, color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap',
};
const td: CSSProperties = { padding: '10px 10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)' };
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const fmtDate = (d: string | null) => (d ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : '―');
const fmtN = (n: number) => (n > 0 ? n.toLocaleString('ko-KR') : '―');

export default function IncomingTab() {
  const [items, setItems] = useState<IncomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);

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

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    const filtered = items
      .filter((i) => !waitingOnly || i.requests.length > 0)
      .filter((i) => !q
        || i.item_name.toLowerCase().includes(q)
        || i.item_code.toLowerCase().includes(q)
        || i.requests.some((r) => r.client_name.toLowerCase().includes(q)));
    if (!sort) return filtered;
    const { key, dir } = sort;
    const f = dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === 'item_name') return a.item_name.localeCompare(b.item_name, 'ko') * f;
      if (key === 'status') return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * f;
      if (key === 'arrival_date') return (a.arrival_date || '9999').localeCompare(b.arrival_date || '9999') * f;
      return ((a[key] || 0) - (b[key] || 0)) * f;
    });
  }, [items, waitingOnly, q, sort]);

  return (
    <Stack gap={16}>
      <Section title="입항품목" meta={`${shown.length}개`} padding="none">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="품명 · 품번 · 거래처 검색"
            style={{
              flex: '1 1 220px', border: '1px solid var(--border-default)', borderRadius: 8,
              padding: '8px 10px', fontSize: 16, background: 'var(--surface)', outline: 'none',
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

        {!loading && shown.length > 0 && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} onClick={() => handleSort(c.key)} title="클릭하여 정렬"
                      style={{ ...th, textAlign: c.align, cursor: 'pointer', userSelect: 'none' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: sort?.key === c.key ? 'var(--action)' : 'var(--text-tertiary)',
                      }}>
                        {c.label}
                        <span style={{ fontSize: 9, opacity: sort?.key === c.key ? 1 : 0.3, width: 8 }}>
                          {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </span>
                    </th>
                  ))}
                  <th style={{ ...th, textAlign: 'left' }}>대기 거래처</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => (
                  <IncomingRow key={it.item_code} it={it}
                    open={openFor === it.item_code}
                    onToggleOpen={() => setOpenFor(openFor === it.item_code ? null : it.item_code)}
                    onRemove={removeReq}
                    onRegistered={() => { setOpenFor(null); void load(); }} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Stack>
  );
}

function IncomingRow({ it, open, onToggleOpen, onRemove, onRegistered }: {
  it: IncomingItem;
  open: boolean;
  onToggleOpen: () => void;
  onRemove: (id: number) => void;
  onRegistered: () => void;
}) {
  return (
    <>
      <tr>
        <td style={td}>
          <span style={{ fontWeight: 600 }}>{it.item_name}</span>
          <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{it.item_code}</span>
        </td>
        <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 12, color: STATUS_COLOR[it.status] }}>{it.status}</span>
        </td>
        <td style={tdNum}>{fmtDate(it.arrival_date)}</td>
        <td style={tdNum}>{fmtN(it.incoming)}</td>
        <td style={tdNum}>{fmtN(it.bonded)}</td>
        <td style={{ ...tdNum, fontWeight: it.available > 0 ? 700 : 400 }}>{fmtN(it.available)}</td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <button onClick={onToggleOpen}
            style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: 'var(--action)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {open ? '닫기' : it.requests.length > 0 ? `대기 ${it.requests.length} · 보기` : '+ 등록'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ ...td, background: 'var(--surface-muted)' }}>
            {it.requests.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
                {it.requests.map((r) => (
                  <span key={r.id} title={`${r.client_code ? r.client_code + ' · ' : ''}${r.manager} 등록${r.memo ? ` · ${r.memo}` : ''}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                    <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-info)' }} />
                    {r.client_name}
                    {r.memo && <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>({r.memo})</span>}
                    <button onClick={() => onRemove(r.id)} aria-label="대기 해제"
                      style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '0 2px' }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <RegisterRow itemCode={it.item_code} itemName={it.item_name} onDone={onRegistered} />
          </td>
        </tr>
      )}
    </>
  );
}
