'use client';

// 정산 화면 — 담은 와인의 수량 조절과 판매가 합계. 풀스크린 시트.
// 합계 = 백화점 할인가 기준, 정상가 합과 할인액을 함께 보여준다.
import { useState } from 'react';
import type { CartItem } from '../hooks/useCart';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function CheckoutSheet({ items, bottles, total, retailTotal, extraRate, extraAmount, finalTotal, storeLabel, onQty, onExtraRate, onClear, onClose }: {
  items: CartItem[]; bottles: number; total: number; retailTotal: number;
  extraRate: number; extraAmount: number; finalTotal: number; storeLabel: string;
  onQty: (itemNo: string, qty: number) => void; onExtraRate: (pct: number) => void;
  onClear: () => void; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const discount = retailTotal - total;
  // 소믈리에 고객정보 단계에서 '재고에서 선택'으로 넘어온 손님 (렌더는 클라이언트 전용 시점)
  const guest = (() => {
    try { return JSON.parse(localStorage.getItem('cave_store_customer') || 'null') as { name?: string } | null; }
    catch { return null; }
  })();

  const copy = async () => {
    const lines = [
      `[CAVE DE VIN 정산] ${storeLabel}${guest?.name ? ` · ${guest.name} 님` : ''}`,
      ...items.map((i) => `- ${i.item_name} ×${i.qty}  ${fmt(i.sale_price * i.qty)}원`),
      ...(extraAmount > 0 ? [`추가 할인 ${extraRate}%  -${fmt(extraAmount)}원`] : []),
      `합계 ${fmt(bottles)}병 ${fmt(finalTotal)}원` + (discount > 0 ? ` (정상 ${fmt(retailTotal)} / 할인 -${fmt(discount + extraAmount)})` : ''),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'max(18px, env(safe-area-inset-top)) 16px 0' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>정산</h2>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          {storeLabel}{guest?.name ? ` · ${guest.name} 님` : ''}
        </span>
        <button onClick={onClose}
          style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)', padding: '4px 2px' }}>
          닫기
        </button>
      </div>
      <div style={{ height: 1, background: 'color-mix(in srgb, #b89a6a 32%, transparent)', margin: '12px 0 0' }} />

      {/* 품목 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {items.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            담긴 와인이 없습니다 — 재고 검색에서 상세를 열고 담아주세요
          </div>
        )}
        {items.map((i) => (
          <div key={i.item_no} style={{ padding: '13px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.item_name}
              </span>
              <span style={{ flex: 'none', fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(i.sale_price * i.qty)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(i.sale_price)}원/병
                {i.retail_price > i.sale_price && (
                  <span style={{ marginLeft: 6, textDecoration: 'line-through' }}>{fmt(i.retail_price)}</span>
                )}
              </span>
              {/* 수량 스테퍼 */}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 999 }}>
                <button onClick={() => onQty(i.item_no, i.qty - 1)} aria-label="수량 감소"
                  style={{ all: 'unset', cursor: 'pointer', padding: '6px 13px', fontSize: 14 }}>−</button>
                {/* 수량 직접 입력 — 숫자만 반영, 지워도 행 유지(0은 − 버튼으로) */}
                <input
                  value={i.qty}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                    if (!Number.isNaN(n)) onQty(i.item_no, Math.min(999, n));
                  }}
                  onFocus={(e) => e.target.select()}
                  inputMode="numeric"
                  style={{ width: 34, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', padding: 0 }} />
                <button onClick={() => onQty(i.item_no, i.qty + 1)} aria-label="수량 증가"
                  style={{ all: 'unset', cursor: 'pointer', padding: '6px 13px', fontSize: 14 }}>+</button>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 합계 + 액션 */}
      {items.length > 0 && (
        <div style={{ borderTop: '2px solid var(--border-strong, var(--border-default))', background: 'var(--surface-muted)', padding: '14px 16px calc(16px + env(safe-area-inset-bottom))' }}>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              <span>정상가 합계</span><span style={{ textDecoration: 'line-through' }}>{fmt(retailTotal)}원</span>
            </div>
          )}
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
              <span>할인</span><span>-{fmt(discount)}원</span>
            </div>
          )}
          {/* 점장 재량 추가 할인 — 할인 아래 별도 행 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontVariantNumeric: 'tabular-nums', marginTop: 5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>추가 할인</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 7, overflow: 'hidden' }}>
              <input
                value={extraRate === 0 ? '' : String(extraRate)}
                onChange={(e) => onExtraRate(Number(e.target.value.replace(/[^0-9]/g, '')))}
                inputMode="numeric" placeholder="0"
                style={{ width: 34, border: 'none', outline: 'none', textAlign: 'right', fontSize: 16, padding: '3px 2px', background: 'transparent', fontVariantNumeric: 'tabular-nums' }} />
              <span style={{ padding: '0 6px 0 1px', color: 'var(--text-tertiary)' }}>%</span>
            </span>
            <span style={{ marginLeft: 'auto', color: extraAmount > 0 ? 'var(--status-success)' : 'var(--text-tertiary)' }}>
              {extraAmount > 0 ? `-${fmt(extraAmount)}원` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>합계 {fmt(bottles)}병</span>
            <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(finalTotal)}원</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => {
              if (!window.confirm('정산 내역을 비울까요?')) return;
              try { localStorage.removeItem('cave_store_customer'); } catch { /* ignore */ }
              onClear();
            }}
              style={{ flex: 'none', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--border-default)', background: 'transparent', fontSize: 13.5, cursor: 'pointer' }}>
              비우기
            </button>
            <button onClick={() => void copy()}
              style={{ flex: 1, padding: '13px 0', borderRadius: 11, border: 'none', background: 'var(--action)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? '복사됨' : '내역 복사'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
