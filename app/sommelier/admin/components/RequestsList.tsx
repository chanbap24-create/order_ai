'use client';

// 소믈리에 관리자 — 매장 직원 수정 요청 목록. 미처리 먼저, 처리 완료는 흐리게(되돌리기 가능).
import { useCallback, useEffect, useState } from 'react';
import { REQUEST_CATEGORIES, type ChangeRequest } from '@/app/lib/sommelierRequestTypes';
import { STORES } from '@/app/lib/store/types';

const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');
const storeLabel = (key: string | null) => STORES.find((s) => s.key === key)?.label || '';

export function RequestsList({ onOpenCountChange }: { onOpenCountChange?: (n: number) => void } = {}) {
  const [rows, setRows] = useState<ChangeRequest[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  // 대기 건수를 부모(어드민 탭 배지)에 동기화 — 처리 완료 즉시 배지도 줄어든다
  const openCount = rows ? rows.filter((r) => r.status === 'open').length : null;
  useEffect(() => {
    if (openCount != null) onOpenCountChange?.(openCount);
  }, [openCount, onOpenCountChange]);

  const load = useCallback(() => {
    fetch('/api/sommelier/requests')
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((j) => setRows(j.requests || []))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = async (id: number, done: boolean) => {
    setRows((prev) => (prev || []).map((r) => (r.id === id ? { ...r, status: done ? 'done' : 'open' } : r)));
    await fetch('/api/sommelier/requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, done }),
    }).catch(() => {});
  };

  if (!rows) return null;
  const open = rows.filter((r) => r.status === 'open');
  const done = rows.filter((r) => r.status === 'done');
  const shown = showDone ? [...open, ...done] : open;

  return (
    <section style={{ margin: '22px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>수정 요청</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: open.length ? 'var(--status-danger)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {open.length}건 대기
        </span>
        {done.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)}
            style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {showDone ? '처리 완료 숨기기' : `처리 완료 ${done.length}건 보기`}
          </button>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--border-default)' }}>
        {shown.length === 0 && (
          <div style={{ padding: '14px 2px', fontSize: 13, color: 'var(--text-tertiary)' }}>대기 중인 요청이 없습니다</div>
        )}
        {shown.map((r) => {
          const isDone = r.status === 'done';
          return (
            <div key={r.id} style={{ padding: '12px 2px', borderBottom: '1px solid var(--border-subtle)', opacity: isDone ? 0.45 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.category === 'other' ? 'var(--text-secondary)' : 'var(--status-warning)' }}>
                  {REQUEST_CATEGORIES[r.category]}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{r.item_no}</span>
                <button onClick={() => void toggle(r.id, !isDone)}
                  style={{
                    all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, padding: '3px 10px', borderRadius: 999,
                    border: '1px solid var(--border-default)', color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  }}>
                  {isDone ? '되돌리기' : '처리 완료'}
                </button>
              </div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>{r.item_name_kr || '-'}</div>
              {r.item_name_en && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{r.item_name_en}</div>}
              {r.message && <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.message}</div>}
              <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                {r.requester}{r.store_key ? ` · ${storeLabel(r.store_key)}` : ''} · {kst(r.created_at)}
                {isDone && r.resolved_by ? ` · 처리 ${r.resolved_by}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
