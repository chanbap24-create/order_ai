'use client';

import { useEffect, useRef, useState } from 'react';
import { searchInventoryByText } from '@/app/inventory/lib/api/inventory';
import type { InventoryItem } from '@/app/inventory/types';
import { fmt } from '../lib/format';

type Props = {
  /** 견적에 담기 — useQuoteItems.addToQuote */
  onAdd: (inv: InventoryItem) => void | Promise<void>;
};

/** 추천견적 편집에서 직접 검색해 품목 추가. 와인명/품번 검색 → 클릭으로 담기. (CDV 재고 기준) */
export function QuoteItemSearchAdd({ onAdd }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchInventoryByText(term, 'CDV');
        if (alive) { setResults(r.slice(0, 30)); setOpen(true); }
      } catch { if (alive) setResults([]); }
      finally { if (alive) setLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const add = async (inv: InventoryItem) => {
    setAddingCode(inv.item_no);
    try { await onAdd(inv); } finally { setAddingCode(null); }
    // 연속 추가를 위해 목록은 유지
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', marginBottom: 10 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder="🔍 품목 직접 검색해서 담기 (와인명·품번)"
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-300)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
      />
      {open && (loading || results.length > 0) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff',
          border: '1px solid var(--border-default)', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
          maxHeight: 320, overflowY: 'auto', marginTop: 4,
        }}>
          {loading && <div style={{ padding: 10, fontSize: 13, color: 'var(--text-muted)' }}>검색 중…</div>}
          {!loading && results.length === 0 && <div style={{ padding: 10, fontSize: 13, color: 'var(--text-muted)' }}>결과 없음</div>}
          {!loading && results.map((r) => (
            <button key={r.item_no} onClick={() => add(r)} disabled={addingCode === r.item_no}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px',
                border: 'none', borderBottom: '1px solid var(--border-default)', background: '#fff',
                textAlign: 'left', cursor: addingCode === r.item_no ? 'default' : 'pointer', fontSize: 13,
              }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b style={{ fontWeight: 600 }}>{r.item_name}</b>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 11 }}>{r.vintage || ''} · {r.item_no}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>재고 {r.available_stock ?? 0}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--action)', whiteSpace: 'nowrap' }}>{fmt(r.supply_price || 0)}</span>
              <span style={{ fontSize: 16, color: 'var(--action)', width: 14, textAlign: 'center' }}>{addingCode === r.item_no ? '…' : '+'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
