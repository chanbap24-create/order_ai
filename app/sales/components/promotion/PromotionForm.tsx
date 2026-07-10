'use client';

import { useState, useRef } from 'react';
import { searchInventoryByText } from '@/app/inventory/lib/api/inventory';

export interface PromotionDraft {
  item_no: string;
  item_name: string;
  quantity: number | null;
  discount_rate: number | null;  // 0~1
  discount_price: number | null;
  memo: string | null;
}

interface Picked { item_no: string; item_name: string; supply_price: number }

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-default)',
  fontSize: 13, background: 'var(--surface-default, #fff)', color: 'var(--text-primary)', width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600 };

export function PromotionForm({ onSave }: { onSave: (d: PromotionDraft) => Promise<void> }) {
  const [q, setQ] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [qty, setQty] = useState('');
  const [ratePct, setRatePct] = useState('');
  const [price, setPrice] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (text: string) => {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 1) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { setResults((await searchInventoryByText(text, 'CDV')).slice(0, 8)); } catch { setResults([]); }
    }, 250);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (r: any) => {
    setPicked({ item_no: r.item_no, item_name: r.item_name, supply_price: r.supply_price || 0 });
    setResults([]); setQ(`${r.item_no} · ${r.item_name}`);
  };

  const supply = picked?.supply_price || 0;
  // 할인률 입력 → 할인가 역산
  const onRate = (v: string) => {
    setRatePct(v);
    const r = Number(v);
    if (supply > 0 && Number.isFinite(r)) setPrice(String(Math.round(supply * (1 - r / 100))));
  };
  // 할인가 입력 → 할인률 역산
  const onPrice = (v: string) => {
    setPrice(v);
    const p = Number(v);
    if (supply > 0 && Number.isFinite(p)) setRatePct(String(Math.round((1 - p / supply) * 1000) / 10));
  };

  const reset = () => {
    setPicked(null); setQ(''); setQty(''); setRatePct(''); setPrice(''); setMemo(''); setResults([]);
  };

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await onSave({
        item_no: picked.item_no,
        item_name: picked.item_name,
        quantity: qty ? Number(qty) : null,
        discount_rate: ratePct ? Math.min(1, Math.max(0, Number(ratePct) / 100)) : null,
        discount_price: price ? Number(price) : null,
        memo: memo.trim() || null,
      });
      reset();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>프로모션 품목 추가</div>

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <div style={labelStyle}>품목 검색 (품번·품명)</div>
        <input style={inputStyle} value={q} onChange={(e) => runSearch(e.target.value)} placeholder="예: 루이 미셸 샤블리" />
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 2,
            background: '#fff', border: '1px solid var(--border-default)', borderRadius: 8,
            maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            {results.map((r) => (
              <button key={r.item_no} onClick={() => pick(r)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                border: 'none', borderBottom: '1px solid var(--gray-100)', background: 'transparent',
                cursor: 'pointer', fontSize: 12.5, color: 'var(--text-primary)',
              }}>
                <b>{r.item_no}</b> · {r.item_name}
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  공급가 {(r.supply_price || 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {picked && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          선택: <b>{picked.item_name}</b> · 공급가 {supply.toLocaleString()}원
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <div><div style={labelStyle}>수량(병)</div><input style={inputStyle} type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><div style={labelStyle}>할인률(%)</div><input style={inputStyle} type="number" value={ratePct} onChange={(e) => onRate(e.target.value)} /></div>
        <div><div style={labelStyle}>할인가(원)</div><input style={inputStyle} type="number" value={price} onChange={(e) => onPrice(e.target.value)} /></div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>메모(선택)</div>
        <input style={inputStyle} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 3월 한정 특가" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={!picked || saving} style={{
          padding: '9px 16px', borderRadius: 8, border: 'none', cursor: picked ? 'pointer' : 'not-allowed',
          background: picked ? 'var(--action)' : 'var(--gray-300)', color: '#fff', fontSize: 13, fontWeight: 700,
        }}>{saving ? '저장 중…' : '프로모션 추가'}</button>
        {picked && (
          <button onClick={reset} style={{
            padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-default)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
          }}>취소</button>
        )}
      </div>
    </div>
  );
}
