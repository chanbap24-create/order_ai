'use client';

// 매장 앱 홈(검색어 비었을 때) — 최근 검색 · 스탯 스트립 · 소믈리에 진입 · 리스트/이번 주 입고.
// 행 렌더는 페이지의 renderRow를 받아 검색 결과와 같은 StockRow 배선을 공유한다.
import type { ReactNode } from 'react';
import type { StoreStockRow } from '@/app/lib/store/types';
import type { Summary } from '../hooks/useStoreApp';
import { fmt, GOLD, LAT } from '../brand';

type ListMode = 'mine' | 'incoming';

const sectionHead = (title: string, aside?: ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 2px 8px' }}>
    <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
    {aside}
  </div>
);

export function StoreHome({
  recent, onRecent, onRemoveRecent, onClearRecent,
  summary, listMode, listRows, onToggleList, onCloseList,
  onSommelier, onArrival, renderRow,
}: {
  recent: string[];
  onRecent: (q: string) => void;
  onRemoveRecent: (q: string) => void;
  onClearRecent: () => void;
  summary: Summary | null;
  listMode: ListMode | null;
  listRows: StoreStockRow[] | null;
  onToggleList: (mode: ListMode) => void;
  onCloseList: () => void;
  onSommelier: () => void;
  onArrival: (itemNo: string) => void;
  renderRow: (row: StoreStockRow) => ReactNode;
}) {
  return (
    <>
      {/* 최근 검색 — 칩 탭=재검색, ×=개별 삭제 */}
      {recent.length > 0 && (
        <section style={{ marginTop: 20 }}>
          {sectionHead('최근 검색', (
            <button onClick={onClearRecent}
              style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
              지우기
            </button>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {recent.map((r) => (
              <span key={r} style={{
                display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)',
                borderRadius: 999, fontSize: 13, color: 'var(--text-secondary)',
              }}>
                <button onClick={() => onRecent(r)}
                  style={{ all: 'unset', cursor: 'pointer', padding: '6px 4px 6px 12px' }}>{r}</button>
                <button onClick={() => onRemoveRecent(r)} aria-label={`${r} 삭제`}
                  style={{ all: 'unset', cursor: 'pointer', padding: '6px 10px 6px 4px', fontSize: 12, color: 'var(--text-tertiary)' }}>×</button>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 스탯 스트립 — 탭하면 해당 리스트 */}
      {summary && (
        <div style={{ display: 'flex', marginTop: 24, borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-subtle)' }}>
          {([
            ['우리 매장', summary.my_items, 'mine'],
            ['들어오는 중', summary.incoming_items, 'incoming'],
          ] as const).map(([label, n, mode], i) => (
            <button key={mode} onClick={() => onToggleList(mode)}
              style={{
                all: 'unset', boxSizing: 'border-box', flex: 1, textAlign: 'center', padding: '14px 0', cursor: 'pointer',
                borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                background: listMode === mode ? 'var(--surface-muted)' : 'transparent',
              }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
              <div style={{ marginTop: 2, fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(n)}종</div>
            </button>
          ))}
        </div>
      )}

      {/* 소믈리에 진입 — 스트립과 헤어라인 공유 */}
      <button onClick={onSommelier}
        style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', textAlign: 'center', cursor: 'pointer', padding: '16px 2px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ ...LAT, fontSize: 13 }}>SOMMELIER</span>
        <span style={{ marginLeft: 10, fontSize: 13, color: GOLD }}>→</span>
      </button>

      {/* 보유/입고 리스트 — 스트립 탭 */}
      {listMode && (
        <section style={{ marginTop: 24 }}>
          {sectionHead(listMode === 'mine' ? '우리 매장 보유' : '들어오는 중', (
            <>
              {listRows && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(listRows.length)}종</span>}
              <button onClick={onCloseList}
                style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
            </>
          ))}
          {!listRows && <div style={{ padding: '16px 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>불러오는 중…</div>}
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {(listRows || []).map(renderRow)}
          </div>
        </section>
      )}

      {/* 이번 주 들어온 와인 */}
      {!listMode && summary && summary.recent_arrivals.length > 0 && (
        <section style={{ marginTop: 24 }}>
          {sectionHead('이번 주 들어온 와인', <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>통관 완료</span>)}
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {summary.recent_arrivals.map((a) => (
              <button key={a.item_no} onClick={() => onArrival(a.item_no)}
                style={{ all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', cursor: 'pointer', padding: '12px 2px', borderBottom: '1px solid var(--border-subtle)', minWidth: 0 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.item_name}</span>
                <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>본사 {fmt(a.hq_available)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
