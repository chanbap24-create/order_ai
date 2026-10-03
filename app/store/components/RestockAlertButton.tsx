'use client';

// 입고 알림 신청 — 입고 예정 와인 상세에서 지정 손님 이름으로. 입고되면 신청한 사원에게 알림.
// 손님 미지정이면 손님 찾기 시트 → 고른 손님으로 지정 후 바로 신청.
import { useState } from 'react';
import { readGuest } from '@/app/lib/store/cartSession';
import { requestRestockAlert } from '../hooks/useRestockAlerts';
import { GuestPickerSheet, type PickedGuest } from './GuestPickerSheet';

export function RestockAlertButton({ itemNo, itemName, storeKey, onGuestPicked }: {
  itemNo: string; itemName: string; storeKey: string;
  onGuestPicked?: () => void; // 손님 찾기로 지정했을 때(헤더 손님 표시 갱신용)
}) {
  const [guest, setGuest] = useState(() => readGuest()); // 로그인 뒤 클라이언트에서만 마운트
  const [picking, setPicking] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const submit = async () => {
    setState('busy');
    setState((await requestRestockAlert(itemNo, itemName, storeKey)) ? 'done' : 'error');
  };
  const onPick = (g: PickedGuest) => { setPicking(false); setGuest(g); onGuestPicked?.(); void submit(); };

  return (
    <>
    <button onClick={guest ? submit : () => setPicking(true)} disabled={state === 'busy' || state === 'done'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 12, padding: '12px 0',
        borderRadius: 11, border: '1px solid var(--border-default)', background: 'var(--surface)', cursor: state === 'done' ? 'default' : 'pointer',
        fontSize: 13.5, fontWeight: 600, color: state === 'done' ? 'var(--status-success)' : 'var(--text-primary)',
      }}>
      {state === 'done' ? `✓ ${guest?.name} 님 입고 알림 신청됨`
        : state === 'error' ? '신청 실패 — 다시 시도'
        : state === 'busy' ? '신청 중…'
        : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          {guest ? `${guest.name} 님 입고 알림 신청` : '손님 찾아서 입고 알림 신청'}</>}
    </button>
    {picking && <GuestPickerSheet title="입고 알림 받을 손님" onPick={onPick} onClose={() => setPicking(false)} />}
    </>
  );
}
