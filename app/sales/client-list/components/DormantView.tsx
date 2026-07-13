'use client';

import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/app/components/ui';

export interface DormantClient {
  client_code: string;
  client_name: string;
  business_type: string | null;
  last_order: string;
  avg_interval_days: number | null;
  elapsed_days: number;
  status: 'dormant' | 'risk';
  outstanding: number;
}

type Props = {
  manager: string;
  picked: Set<string>;
  onTogglePick: (code: string) => void;
  onPickAll: (codes: string[]) => void;
  /** 로드 완료 시 부모에 목록 전달(일괄 추천 타겟용) */
  onLoaded?: (clients: DormantClient[]) => void;
};

const fmtDate = (s: string) => s?.slice(2).replace(/-/g, '.') || '-';

/**
 * 휴면·이탈위험 거래처 뷰 — 윈백 대상 자동 발굴.
 * 본인 발주주기 기준(2배=이탈위험, 3배=휴면). 미수형은 배지만(윈백 선택 불가 — 수금 먼저).
 */
export function DormantView({ manager, picked, onTogglePick, onPickAll, onLoaded }: Props) {
  const [list, setList] = useState<DormantClient[] | null>(null);
  const [counts, setCounts] = useState({ dormant: 0, risk: 0, misu: 0 });
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setList(null); setErr('');
    fetch(`/api/sales/clients/dormant?manager=${encodeURIComponent(manager)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) { setErr(j.error); setList([]); return; }
        setList(j.clients || []);
        setCounts(j.counts || { dormant: 0, risk: 0, misu: 0 });
        onLoaded?.(j.clients || []);
      })
      .catch(() => { if (alive) { setErr('조회 실패'); setList([]); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager]);

  if (list === null) return <ListSkeleton rows={6} />;
  if (err) return <div style={{ padding: 20, fontSize: 13, color: 'var(--status-danger)' }}>{err}</div>;

  const selectable = list.filter((c) => c.outstanding <= 0).map((c) => c.client_code);
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c));

  return (
    <div>
      {/* 스탯 스트립 */}
      <div style={{
        display: 'flex', alignItems: 'stretch', overflowX: 'auto',
        borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)',
        marginBottom: 14,
      }}>
        <Stat label="휴면" value={`${counts.dormant}곳`} danger={counts.dormant > 0} />
        <Stat label="이탈 위험" value={`${counts.risk}곳`} warn={counts.risk > 0} divider />
        <Stat label="미수 보류" value={`${counts.misu}곳`} divider />
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>
        본인 발주주기 기준 자동 발굴 (2배 경과=이탈 위험 · 3배=휴면) · 미수 거래처는 수금 먼저 — 윈백 선택 불가
      </div>

      {list.length === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          휴면·이탈위험 거래처가 없어요 — 모두 정상 리듬이에요 👍
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border-default)' }}>
          {/* 헤더 행 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderBottom: '1px solid var(--border-default)' }}>
            <input
              type="checkbox" checked={allPicked}
              onChange={() => onPickAll(allPicked ? [] : selectable)}
              style={{ width: 15, height: 15, accentColor: 'var(--action)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', flex: 1 }}>거래처</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', width: 150, textAlign: 'right' }}>발주 리듬 → 경과</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', width: 70, textAlign: 'right' }}>마지막</span>
          </div>
          {list.map((c) => {
            const misu = c.outstanding > 0;
            return (
              <div
                key={c.client_code}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 2px',
                  borderBottom: '1px solid var(--border-subtle)', opacity: misu ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={picked.has(c.client_code)}
                  disabled={misu}
                  onChange={() => onTogglePick(c.client_code)}
                  title={misu ? '미수 잔액이 있어 윈백 대상에서 제외 (수금 먼저)' : ''}
                  style={{ width: 15, height: 15, accentColor: 'var(--action)', cursor: misu ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.client_name}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700,
                      color: c.status === 'dormant' ? 'var(--status-danger)' : 'var(--status-warning)',
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.status === 'dormant' ? 'var(--status-danger)' : 'var(--status-warning)' }} />
                      {c.status === 'dormant' ? '휴면' : '이탈 위험'}
                    </span>
                    {misu && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                        미수 {c.outstanding.toLocaleString()}원
                      </span>
                    )}
                  </div>
                  {c.business_type && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{c.business_type}</div>
                  )}
                </div>
                <div style={{ width: 150, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {c.avg_interval_days != null ? `평소 ${c.avg_interval_days}일` : '주기 미상'} →{' '}
                  </span>
                  <b style={{ color: c.status === 'dormant' ? 'var(--status-danger)' : 'var(--status-warning)' }}>
                    {c.elapsed_days}일
                  </b>
                </div>
                <div style={{ width: 70, textAlign: 'right', fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDate(c.last_order)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, divider, danger, warn }: { label: string; value: string; divider?: boolean; danger?: boolean; warn?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 110, padding: '12px 16px', borderLeft: divider ? '1px solid var(--border-default)' : 'none' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
        color: danger ? 'var(--status-danger)' : warn ? 'var(--status-warning)' : 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}
