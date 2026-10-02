'use client';

// 매장 앱 홈(검색어 비었을 때) — 검색이 주인공, 나머지는 배경으로.
// 최근 검색(검색바 꼬리) · 보유/입고 리스트 링크(조용히) · 이번 주 입고. 소믈리에 진입은 헤더 워드마크.
// 행 렌더는 페이지의 renderRow를 받아 검색 결과와 같은 StockRow 배선을 공유한다.
import { useState, type ReactNode } from 'react';
import type { StoreStockRow } from '@/app/lib/store/types';
import type { Summary } from '../hooks/useStoreApp';
import { fmt } from '../brand';

type ListMode = 'mine' | 'incoming';

const sectionHead = (title: string, aside?: ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 2px 8px' }}>
    <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
    {aside}
  </div>
);

export function StoreHome({
  recent, onRecent, onClearRecent,
  summary, listMode, listRows, onToggleList, onCloseList,
  onArrival, renderRow,
}: {
  recent: string[];
  onRecent: (q: string) => void;
  onClearRecent: () => void;
  summary: Summary | null;
  listMode: ListMode | null;
  listRows: StoreStockRow[] | null;
  onToggleList: (mode: ListMode) => void;
  onCloseList: () => void;
  onArrival: (itemNo: string) => void;
  renderRow: (row: StoreStockRow) => ReactNode;
}) {
  // 이번 주 입고는 summary에 이미 있는 데이터라 화면 안에서만 펼침 — 보유/입고 리스트와 동시에 하나만 열림
  const [arrivalsOpen, setArrivalsOpen] = useState(false);
  type LinkKey = ListMode | 'arrivals';
  const openKey: LinkKey | null = arrivalsOpen ? 'arrivals' : listMode;
  const links: { key: LinkKey; label: string; n: number }[] = summary ? [
    { key: 'mine', label: '우리 매장', n: summary.my_items },
    { key: 'incoming', label: '들어오는 중', n: summary.incoming_items },
    ...(summary.recent_arrivals.length > 0 ? [{ key: 'arrivals' as const, label: '이번 주 입고', n: summary.recent_arrivals.length }] : []),
  ] : [];
  const toggle = (key: LinkKey) => {
    if (key === 'arrivals') {
      if (listMode) onCloseList();
      setArrivalsOpen((v) => !v);
    } else {
      setArrivalsOpen(false);
      onToggleList(key);
    }
  };

  return (
    <>
      {/* 최근 검색 — 제목 없이 검색바 꼬리처럼 한 줄(가로 스와이프). 칩은 글자만, 지우기는 줄 끝 하나 */}
      {recent.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', marginTop: 12,
          overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none', paddingBottom: 2,
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
      )}


      {/* 목록 링크 한 줄 — 우리 매장 · 들어오는 중 · 이번 주 입고. 누를 때만 펼침(자동으로 생기지 않음) */}
      {summary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 28, padding: '0 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          {links.map(({ key, label, n }, i) => (
            <span key={key} style={{ display: 'inline-flex', gap: 6 }}>
              {i > 0 && <span aria-hidden>·</span>}
              <button onClick={() => toggle(key)}
                style={{
                  all: 'unset', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
                  textDecorationColor: 'var(--border-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  color: openKey === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontWeight: openKey === key ? 700 : 400,
                }}>
                {label} {fmt(n)}종
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 보유/입고 리스트 */}
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

      {/* 이번 주 입고 — 링크로 열었을 때만 */}
      {arrivalsOpen && summary && (
        <section style={{ marginTop: 24 }}>
          {sectionHead('이번 주 입고', (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>통관 완료</span>
              <button onClick={() => setArrivalsOpen(false)}
                style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
            </>
          ))}
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
