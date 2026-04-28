'use client';

import { useEffect } from 'react';
import { DateView } from '@/app/sales/item-ledger/components/DateView';
import { ClientView } from '@/app/sales/item-ledger/components/ClientView';
import { fmt } from '@/app/sales/item-ledger/lib/format';
import type { useItemLedgerPopup } from '../hooks/useItemLedgerPopup';

type Props = {
  popup: ReturnType<typeof useItemLedgerPopup>;
  warehouse: 'CDV' | 'DL';
};

export function ItemLedgerPopup({ popup, warehouse }: Props) {
  // body scroll lock while open. 동시 열린 모달이 있어도 race 없이 작동하도록 카운터.
  useEffect(() => {
    if (!popup.open) return;
    const body = document.body;
    const cur = Number(body.dataset.scrollLock || '0') + 1;
    body.dataset.scrollLock = String(cur);
    if (cur === 1) body.style.overflow = 'hidden';
    return () => {
      const next = Math.max(0, Number(body.dataset.scrollLock || '0') - 1);
      body.dataset.scrollLock = String(next);
      if (next === 0) body.style.overflow = '';
    };
  }, [popup.open]);

  if (!popup.open) return null;

  const r = popup.ranges[popup.rangeIdx];

  return (
    <div
      onClick={popup.close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(20,12,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14,
          width: '100%', maxWidth: 920, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '2px solid #5A1515',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#8a8580', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              세일즈 품목별 · {warehouse === 'DL' ? '대유라이프' : '까브드뱅'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2c1810', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {popup.itemName || popup.itemNo}
              <span style={{ fontSize: 11, color: '#8a8580', fontWeight: 500, marginLeft: 8, fontFamily: 'monospace' }}>
                {popup.itemNo}
              </span>
            </div>
          </div>
          <button
            onClick={popup.close}
            aria-label="닫기"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 22, color: '#8a8580', padding: '4px 10px', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Range tabs + view toggle */}
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid rgba(90,21,21,0.06)',
          display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {popup.ranges.map((rg, i) => (
              <button
                key={rg.label}
                onClick={() => popup.selectRange(i)}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid ' + (i === popup.rangeIdx ? '#5A1515' : 'rgba(90,21,21,0.15)'),
                  background: i === popup.rangeIdx ? '#5A1515' : '#fff',
                  color: i === popup.rangeIdx ? '#fff' : '#5A1515',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {rg.label}
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#8a8580', alignSelf: 'center', marginLeft: 4 }}>
              {r.start.slice(2)} ~ {r.end.slice(2)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(90,21,21,0.04)', borderRadius: 6, padding: 2 }}>
            {([['client', '거래처별'], ['date', '날짜별']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => popup.setViewMode(m)}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none',
                  fontSize: 11, fontWeight: popup.viewMode === m ? 700 : 500,
                  background: popup.viewMode === m ? '#fff' : 'transparent',
                  color: popup.viewMode === m ? '#5A1515' : '#8a8580',
                  cursor: 'pointer', boxShadow: popup.viewMode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(90,21,21,0.08)' }}>
          {[
            { label: '총 수량', value: fmt(popup.totals.qty), unit: '' },
            { label: '총 금액', value: fmt(popup.totals.supply), unit: '원' },
            { label: '거래처 수', value: String(popup.totals.clients), unit: '개' },
          ].map((c, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 14px', textAlign: 'center',
              borderRight: i < 2 ? '1px solid rgba(90,21,21,0.06)' : 'none',
            }}>
              <div style={{ fontSize: 10, color: '#8a8580', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#5A1515', marginTop: 2 }}>
                {c.value}<span style={{ fontSize: 11, fontWeight: 500, color: '#8a8580' }}>{c.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {popup.loading && (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 12 }}>조회 중...</div>
          )}
          {!popup.loading && popup.error && (
            <div style={{ padding: 24, color: '#dc2626', fontSize: 12, textAlign: 'center' }}>{popup.error}</div>
          )}
          {!popup.loading && !popup.error && popup.totals.qty === 0 && popup.rows.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 12 }}>
              해당 기간 출고 내역이 없습니다.
            </div>
          )}
          {!popup.loading && !popup.error && popup.rows.length > 0 && (
            popup.viewMode === 'date'
              ? <DateView rows={popup.rows} />
              : <ClientView summary={popup.clientSummary} />
          )}
        </div>
      </div>
    </div>
  );
}
