'use client';

// 통관 완료 알림 팝업 — 기다리는 거래처가 등록된 와인이 통관되면 접속 시 1회 표시.
import { useEffect, useState } from 'react';
import type { ArrivalNotice } from '@/app/lib/incomingRequests';

export function IncomingArrivalPopup() {
  const [notices, setNotices] = useState<ArrivalNotice[]>([]);

  useEffect(() => {
    fetch('/api/sales/incoming/check').then((r) => r.json())
      .then((j) => setNotices(Array.isArray(j.notices) ? j.notices : []))
      .catch(() => {});
  }, []);

  if (notices.length === 0) return null;

  const ack = async () => {
    const codes = notices.map((n) => n.item_code);
    setNotices([]);
    try {
      await fetch('/api/sales/incoming/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCodes: codes }),
      });
    } catch { /* ignore */ }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: 'min(480px, 100%)',
        maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
        padding: '22px 22px 18px',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>기다리던 와인이 통관 완료됐어요</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          아래 거래처에 입고 소식을 안내해 주세요
        </div>

        {notices.map((n) => (
          <div key={n.item_code} style={{ borderTop: '1px solid var(--border-subtle)', padding: '11px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{n.item_name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                가용 {n.available}병
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 5 }}>
              {n.requests.map((r) => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                  <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-info)' }} />
                  {r.client_name}{r.memo ? ` (${r.memo})` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={ack} style={{
            border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13.5, fontWeight: 600,
            background: 'var(--action)', color: 'var(--text-on-primary)', cursor: 'pointer',
          }}>
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
}
