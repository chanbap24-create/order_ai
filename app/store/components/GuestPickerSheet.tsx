'use client';

// 손님 찾기 시트 — 손님 미지정 상태에서 입고 알림을 누르면 열림. 이름으로 찾아 고르면 그 손님으로 응대 지정(카트 유지).
// 목록 범위는 고객 페이지와 같음(서버 세션 기준). 처음 오신 손님은 맞춤 추천의 손님 정보에서 등록.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { syncGuest } from '@/app/lib/store/cartSession';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
import { useCustomerSearch } from '../hooks/useCustomerSearch';

export type PickedGuest = { id: number; name: string };

export function GuestPickerSheet({ title, onPick, onClose }: {
  title: string;                         // 예: '입고 알림 받을 손님'
  onPick: (g: PickedGuest) => void;      // 손님 지정(syncGuest) 뒤 호출
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const { rows, error } = useCustomerSearch(q);
  const pick = (g: PickedGuest) => { syncGuest(g); onPick(g); };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '80dvh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '12px 12px 0 0',
          padding: '10px 22px calc(16px + env(safe-area-inset-bottom))', color: 'var(--text-primary)',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          <button type="button" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
        </div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="어떤 손님을 찾으세요?" inputMode="search"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 2px', fontSize: 16, // 16px = iOS 확대 방지
            border: 'none', borderBottom: '1px solid var(--border-default)', outline: 'none', background: 'transparent', color: 'var(--text-primary)',
          }} />
        <div style={{ overflowY: 'auto', minHeight: 120 }}>
          {error && <p style={{ padding: '16px 0', fontSize: 13, color: 'var(--status-danger)' }}>{error}</p>}
          {!rows && !error && <ListSkeleton rows={4} />}
          {rows && rows.length === 0 && (
            <p style={{ margin: 0, padding: '22px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {q.trim() ? '찾는 손님이 없어요' : '아직 등록한 손님이 없어요'}<br />처음 오신 손님은 맞춤 추천의 손님 정보에서 등록해 주세요
            </p>
          )}
          {(rows || []).map((c) => (
            <button key={c.id} type="button" onClick={() => pick({ id: c.id, name: c.name })}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 10, width: '100%', padding: '14px 2px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{c.phoneMasked}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{c.lastVisit.replace(/-/g, '.')} 방문</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
