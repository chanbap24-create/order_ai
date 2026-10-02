'use client';

// 입고 알림 목록 바텀시트 — 입고됨(연락할 손님) → 대기 → 완료. 연락처는 신청한 사원 본인에게만.
import type { RestockAlert } from '@/app/lib/store/restockAlertTypes';
import { STORES, arrivalLabel } from '@/app/lib/store/types';
import { todayKst } from '@/app/lib/dateKst';

const STATUS: Record<RestockAlert['status'], { label: string; color: string }> = {
  arrived: { label: '입고됨', color: 'var(--status-success)' },
  waiting: { label: '대기', color: 'var(--text-tertiary)' },
  done: { label: '연락 완료', color: 'var(--text-muted)' },
};
const md = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 10).replace('-', '/') : '');
// 입항일이 지났는데 아직 대기(가용재고 전): 보세에 있으면 '통관 중', 없으면 '지연'
const etaInfo = (eta: string | null, bonded: number) => {
  if (!eta) return { text: '입고일 미정', color: 'var(--text-tertiary)' };
  const { md, state } = arrivalLabel(eta, todayKst(), bonded);
  if (state === 'late') return { text: `${md} 예정 · 지연`, color: 'var(--status-danger)' };
  if (state === 'customs') return { text: `${md} 입항 · 통관 중`, color: 'var(--status-warning)' };
  return { text: `${md} 입고 예정`, color: 'var(--status-warning)' };
};
const telFmt = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
const storeLabel = (key: string) => STORES.find((s) => s.key === key)?.label || key;

export function RestockAlertsSheet({ alerts, onAct, onClose }: {
  alerts: RestockAlert[];
  onAct: (id: number, action: 'done' | 'cancel') => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', maxHeight: '82dvh', overflowY: 'auto', background: 'var(--surface)',
          borderRadius: '12px 12px 0 0', padding: '10px 20px calc(24px + env(safe-area-inset-bottom))',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>입고 알림</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>내가 신청한 손님</span>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
        </div>

        {alerts.length === 0 && (
          <p style={{ margin: 0, padding: '28px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            신청한 알림이 없습니다<br />입고 예정 와인 상세에서 손님 이름으로 신청할 수 있어요
          </p>
        )}

        {alerts.map((a) => {
          const st = STATUS[a.status];
          return (
            <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)', opacity: a.status === 'done' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, color: st.color }}>{st.label}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.item_name || a.item_no}</span>
                {/* 입고 예정일 — 대기 건만(입고됨은 아래 입고일 표기) */}
                {a.status === 'waiting' && (
                  <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: etaInfo(a.eta, a.bonded).color }}>
                    {etaInfo(a.eta, a.bonded).text}
                    {a.incoming_btls > 0 && <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>{a.incoming_btls.toLocaleString('ko-KR')}병</span>}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                <span>{a.customer_name} 님</span>
                {a.customer_phone && (
                  <a href={`tel:${a.customer_phone}`} style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{telFmt(a.customer_phone)}</a>
                )}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {storeLabel(a.store_key)} · {md(a.created_at)} 신청{a.arrived_at ? ` · ${md(a.arrived_at)} 입고` : ''}
              </div>
              {a.status !== 'done' && (
                <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                  {a.status === 'arrived' && (
                    <button onClick={() => onAct(a.id, 'done')}
                      style={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--action)' }}>연락 완료</button>
                  )}
                  <button onClick={() => { if (confirm('이 알림 신청을 취소할까요?')) onAct(a.id, 'cancel'); }}
                    style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}>신청 취소</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
