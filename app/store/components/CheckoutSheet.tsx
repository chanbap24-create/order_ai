'use client';

// 정산 화면 — 담은 와인의 수량 조절과 판매가 합계. 풀스크린 시트.
// 합계 = 백화점 할인가 기준, 정상가 합과 할인액을 함께 보여준다.
import { useState } from 'react';
import type { CartItem } from '../hooks/useCart';
import { endGuestSession, readGuest } from '@/app/lib/store/cartSession';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function CheckoutSheet({ items, bottles, total, retailTotal, extraRate, extraWon, extraAmount, finalTotal, storeLabel, onQty, onExtraRate, onExtraWon, onClear, onClose, continueTo }: {
  items: CartItem[]; bottles: number; total: number; retailTotal: number;
  extraRate: number; extraWon: number; extraAmount: number; finalTotal: number; storeLabel: string;
  onQty: (itemNo: string, qty: number) => void;
  onExtraRate: (pct: number) => void; onExtraWon: (won: number) => void;
  onClear: () => void; onClose: () => void;
  // 반대편으로 이어가기 — 재고 앱에선 '취향 문답으로', 추천 결과에선 '재고에서 고르기'. 카트·손님 유지
  continueTo?: { label: string; onClick: () => void } | null;
}) {
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const discount = retailTotal - total;
  // 소믈리에 고객정보 단계에서 '재고에서 선택'으로 넘어온 손님 (렌더는 클라이언트 전용 시점)
  const guest = readGuest();

  /** 판매 완료 — 손님(동의)이 있으면 구매 이력 저장(관리자 조회, 소믈리에 기록과 같은 테이블) 후
   *  정산·손님 연결을 비우고 닫아 다음 손님 응대 준비. 미동의 손님은 이력 없이 비우기만. */
  const complete = async () => {
    if (completing || completed) return;
    const msg = guest?.id
      ? `${guest.name ? `${guest.name} 님 ` : ''}판매를 완료할까요?\n구매 이력에 저장하고 정산을 비웁니다.`
      : '판매를 완료할까요?\n(정보 미동의 손님 — 이력 저장 없이 정산만 비웁니다)';
    if (!window.confirm(msg)) return;
    setCompleting(true);
    try {
      if (guest?.id) {
        // 추가 할인(%·금액)을 품목 단가에 비례 배분 — 기록 매출 = 실제 결제액(10원 단위)
        const factor = total > 0 ? finalTotal / total : 1;
        const results = await Promise.all(items.map((i) =>
          fetch('/api/sommelier/order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: guest.id, itemCode: i.item_no, itemName: i.item_name,
              retailPrice: Math.round((i.sale_price * factor) / 10) * 10, quantity: i.qty,
              mode: 'set', // 같은 손님·품번·같은 날은 덮어쓰기 — 재시도해도 중복 안 쌓임
            }),
          }).then((r) => r.ok)));
        if (!results.every(Boolean)) { alert('이력 저장에 실패했습니다. 다시 눌러주세요.'); return; }
      }
      setCompleted(true);
      // 완료 표시를 잠깐 보여준 뒤 다음 손님 준비
      setTimeout(() => { endGuestSession(); onClear(); }, 700);
    } catch {
      alert('판매 완료 처리에 실패했습니다. 다시 눌러주세요.');
    } finally {
      setCompleting(false);
    }
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
          {/* 추가 할인 — %와 금액 중 하나로 입력 (한쪽을 쓰면 다른 쪽 해제) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontVariantNumeric: 'tabular-nums', marginTop: 5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>추가 할인</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 7, overflow: 'hidden' }}>
              <input
                value={extraRate === 0 ? '' : String(extraRate)}
                onChange={(e) => onExtraRate(Number(e.target.value.replace(/[^0-9]/g, '')))}
                inputMode="numeric" placeholder="0"
                style={{ width: 30, border: 'none', outline: 'none', textAlign: 'right', fontSize: 16, padding: '3px 2px', background: 'transparent', fontVariantNumeric: 'tabular-nums' }} />
              <span style={{ padding: '0 6px 0 1px', color: 'var(--text-tertiary)' }}>%</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 7, overflow: 'hidden' }}>
              <input
                value={extraWon === 0 ? '' : extraWon.toLocaleString('ko-KR')}
                onChange={(e) => onExtraWon(Number(e.target.value.replace(/[^0-9]/g, '')))}
                inputMode="numeric" placeholder="0"
                style={{ width: 72, border: 'none', outline: 'none', textAlign: 'right', fontSize: 16, padding: '3px 2px', background: 'transparent', fontVariantNumeric: 'tabular-nums' }} />
              <span style={{ padding: '0 6px 0 1px', color: 'var(--text-tertiary)' }}>원</span>
            </span>
            <span style={{ marginLeft: 'auto', color: extraAmount > 0 ? 'var(--status-success)' : 'var(--text-tertiary)' }}>
              {extraAmount > 0 ? `-${fmt(extraAmount)}원` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>합계 {fmt(bottles)}병</span>
            <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(finalTotal)}원</span>
          </div>
          {/* 반대편으로 이어서 담기 — 재고 ↔ 추천 왕복, 카트·손님 유지 */}
          {continueTo && (
            <button onClick={continueTo.onClick}
              style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', textAlign: 'center', cursor: 'pointer', marginTop: 12, padding: '10px 0', fontSize: 12.5, color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(184,154,106,0.6)' }}>
              {continueTo.label}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => {
              if (!window.confirm('정산 내역을 비울까요?')) return;
              endGuestSession();
              onClear();
            }}
              style={{ flex: 'none', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--border-default)', background: 'transparent', fontSize: 13.5, cursor: 'pointer' }}>
              비우기
            </button>
            <button onClick={() => void complete()}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 11, border: 'none', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
                background: completed ? 'var(--status-success)' : 'var(--action)', color: '#fff', opacity: completing ? 0.6 : 1,
                transition: 'background 0.2s ease',
              }}>
              {completed ? '✓ 판매 완료' : completing ? '처리 중…' : `판매 완료 · ${fmt(finalTotal)}원`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
