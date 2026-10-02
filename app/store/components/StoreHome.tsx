'use client';

// 매장 앱 홈(검색어 비었을 때) — 최근 검색 칩 + (메뉴로 연) 매장 재고·입고 예정·금주 입고 목록.
// 목록 열기는 헤더 메뉴(⋮⋮⋮)가 담당. 행 렌더는 페이지의 renderRow를 받아 검색 결과와 같은 배선을 공유한다.
import type { ReactNode } from 'react';
import type { StoreStockRow } from '@/app/lib/store/types';
import type { ListMode, Summary } from '../hooks/useStoreApp';
import { fmt } from '../brand';

const LIST_TITLE: Record<ListMode, string> = { mine: '매장 재고', incoming: '입고 예정', arrivals: '금주 입고' };

const sectionHead = (title: string, aside?: ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 2px 8px' }}>
    <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
    {aside}
  </div>
);

export function StoreHome({
  recent, onRecent, onClearRecent, centered,
  summary, listMode, listRows, onCloseList, onArrival, renderRow,
}: {
  recent: string[];
  onRecent: (q: string) => void;
  onClearRecent: () => void;
  centered: boolean; // 첫 화면(구글식)에서는 최근 검색 칩을 가운데로
  summary: Summary | null;
  listMode: ListMode | null;
  listRows: StoreStockRow[] | null;
  onCloseList: () => void;
  onArrival: (itemNo: string) => void;
  renderRow: (row: StoreStockRow) => ReactNode;
}) {
  return (
    <>
      {/* 최근 검색 — 한 줄(가로 스와이프). 첫 화면에선 가운데, 넘치면 스크롤 */}
      {recent.length > 0 && (
        <div style={{ overflowX: 'auto', scrollbarWidth: 'none', marginTop: 14, paddingBottom: 2 }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap', width: 'max-content',
            margin: centered ? '0 auto' : 0,
          }}>
            {recent.map((r) => (
              <button key={r} onClick={() => onRecent(r)}
                style={{
                  all: 'unset', flex: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999,
                  border: '1px solid var(--border-default)', fontSize: 13, color: 'var(--text-secondary)',
                }}>
                {r}
              </button>
            ))}
            <button onClick={onClearRecent}
              style={{ all: 'unset', flex: 'none', cursor: 'pointer', padding: '6px 4px', fontSize: 12, color: 'var(--text-tertiary)' }}>
              지우기
            </button>
          </div>
        </div>
      )}

      {/* 메뉴로 연 목록 */}
      {listMode && (
        <section style={{ marginTop: 24 }}>
          {sectionHead(LIST_TITLE[listMode], (
            <>
              {listMode === 'arrivals'
                ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>통관 완료</span>
                : listRows && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(listRows.length)}종</span>}
              <button onClick={onCloseList}
                style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
            </>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {listMode === 'arrivals'
              ? (summary?.recent_arrivals || []).map((a) => (
                <button key={a.item_no} onClick={() => onArrival(a.item_no)}
                  style={{ all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', cursor: 'pointer', padding: '12px 2px', borderBottom: '1px solid var(--border-subtle)', minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.item_name}</span>
                  <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>본사 {fmt(a.hq_available)}</span>
                </button>
              ))
              : (
                <>
                  {!listRows && <div style={{ padding: '16px 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>불러오는 중…</div>}
                  {(listRows || []).map(renderRow)}
                </>
              )}
          </div>
        </section>
      )}
    </>
  );
}
