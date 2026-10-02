'use client';

// 전송 단계 — 배송 예정일 + 특이사항 한 줄.
// 자동 계산(컷오프·주말·휴일) 기본, 금요일 마감 전엔 토/월 선택, 달력으로 직접 지정 가능(직접 지정이 최우선).
import type { FridayChoice } from '@/app/order-v2/types';
import { todayKst } from '@/app/lib/dateKst';

const chip = (active: boolean) => ({
  all: 'unset' as const, cursor: 'pointer', fontSize: 12, padding: '4px 9px', borderRadius: 7, flex: 'none' as const,
  border: `1px solid ${active ? 'var(--action)' : 'var(--border-default)'}`,
  fontWeight: active ? 700 : 400,
});

export function DeliveryRow({
  label, paymentFirst, fridayOptions, fridayChoice, onFridayChoice,
  customDate, onCustomDate, notes, onNotes,
}: {
  label: string;
  paymentFirst: boolean;
  fridayOptions: boolean; // 금요일 마감 전 접수 — 토/월 중 선택 필요
  fridayChoice: FridayChoice;
  onFridayChoice: (c: FridayChoice) => void;
  customDate: string; // YYYY-MM-DD, 빈 문자열 = 자동
  onCustomDate: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
}) {
  return (
    <div style={{ padding: '4px 2px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', flex: 'none' }}>배송 예정일</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
          {label || (fridayOptions ? '토/월 선택' : '—')}
        </span>
        {paymentFirst && !customDate && (
          <span style={{ fontSize: 11.5, color: 'var(--status-warning)', flex: 'none' }}>입금확인 · 영업일 +2 자동</span>
        )}

        {/* 금요일 마감 전 — 토/월 (직접 지정하면 비활성 표시) */}
        {fridayOptions && !paymentFirst && (
          <span style={{ display: 'inline-flex', gap: 6, flex: 'none' }}>
            {(['saturday', 'monday'] as const).map((c) => (
              <button key={c} onClick={() => { onCustomDate(''); onFridayChoice(c); }}
                style={chip(fridayChoice === c && !customDate)}>
                {c === 'saturday' ? '토요일' : '월요일'}
              </button>
            ))}
          </span>
        )}

        {/* 직접 지정 — 달력. 지정하면 자동 계산보다 우선, '자동'으로 되돌리기 */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', marginLeft: 'auto' }}>
          <input
            type="date"
            value={customDate}
            min={todayKst()}
            onChange={(e) => onCustomDate(e.target.value)}
            aria-label="배송일 직접 지정"
            style={{
              padding: '5px 8px', fontSize: 16, borderRadius: 8, outline: 'none', background: 'var(--surface)',
              border: `1px solid ${customDate ? 'var(--action)' : 'var(--border-default)'}`,
              color: customDate ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          />
          {customDate && (
            <button onClick={() => onCustomDate('')} style={chip(false)}>자동</button>
          )}
        </span>
      </div>

      <input
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="특이사항 (선택)"
        style={{
          width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '8px 10px', fontSize: 16,
          border: '1px solid var(--border-subtle)', borderRadius: 8, outline: 'none', background: 'var(--surface)',
        }}
      />
    </div>
  );
}
