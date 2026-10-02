'use client';

// 검색 결과 한 행 — "매장 N · 본사 N · 입고 N". 다른 매장 재고는 매장 직원에게 보이지 않는다.
// 색은 숫자에만: 초록=지금 팔 수 있음 · 주황=입고 예정 · 회색=없음.
// 탭=상세 바텀시트, 꾹(0.5초)=테이스팅 노트 바로 열기.
import { useRef, type ReactNode } from 'react';
import { arrivalLabel, stockTierOf, type StockTier, type StoreKey, type StoreStockRow } from '@/app/lib/store/types';
import { todayKst } from '@/app/lib/dateKst';
import { GOLD } from '../brand';
import { AlertBell } from './AlertBell';

const fmt = (n: number) => n.toLocaleString('ko-KR');
const LONG_PRESS_MS = 500;

// 입항일 꼬리 — 지났는데 보세에도 없으면 날짜를 빨갛게(지연). 행 폭이 좁아 글자 대신 색으로,
// '예정 · 지연' / '보세 · 통관 중' 문구는 상세·입고 알림 목록에서.
const arrivalSuffix = (date: string, bonded: number) => {
  const { md, state } = arrivalLabel(date, todayKst(), bonded);
  return state === 'late'
    ? <span title="입항일 지남 · 지연" style={{ color: 'var(--status-danger)', fontWeight: 600 }}>·{md}</span>
    : <>·{md}</>;
};

// 재고 위치 음영 — 우리 매장=흰색(바로 판매 가능) · 우리 매장에 없음(다른 매장·본사)=회색.
// 회색은 저채도 모니터·밝은 매장 조명에서도 구분되게 8% (surface-active 6%로는 약했음)
const ELSEWHERE_BG = 'color-mix(in srgb, var(--action) 8%, transparent)';
const TIER_BG: Record<StockTier, string> = {
  0: 'transparent',
  1: ELSEWHERE_BG,
  2: ELSEWHERE_BG,
  3: ELSEWHERE_BG,
};

export function StockRow({ row, storeKey, onOpen, onLongPress, onAdd, onAlert, alerted }: {
  row: StoreStockRow; storeKey: StoreKey; onOpen: () => void;
  onLongPress?: (() => void) | null; // 테이스팅 노트 (있는 품목만)
  onAdd?: () => void;                // 정산에 바로 담기 (POS 빠른 흐름)
  onAlert?: () => void;              // 입고 예정 목록 — + 대신 입고 알림 벨(신청/취소 토글)
  alerted?: boolean;                 // 지금 손님으로 이미 신청됨
}) {
  const mine = row.stores[storeKey] || 0;
  const soldOutEverywhere = mine <= 0 && row.hq_available <= 0; // 이 매장·본사 기준(다른 매장 재고는 비노출)

  // 롱프레스 — 발화 후의 클릭(손 뗄 때)은 무시, 10px 이상 움직이면 취소(스크롤 중)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    origin.current = null;
  };
  const start = (e: React.PointerEvent) => {
    fired.current = false;
    if (!onLongPress) return;
    origin.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      fired.current = true;
      try { navigator.vibrate?.(10); } catch { /* ignore */ }
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const move = (e: React.PointerEvent) => {
    if (!origin.current) return;
    if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) cancel();
  };

  const cell = (label: string, n: number, kind: 'ok' | 'zero' | 'warn', extra?: ReactNode) => (
    <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-tertiary)' }}>
      {label}
      <b style={{
        marginLeft: 3, fontWeight: 700,
        color: kind === 'ok' ? 'var(--status-success)' : kind === 'warn' ? 'var(--status-warning)' : 'var(--neutral-400, #c2c4c9)',
      }}>{fmt(n)}</b>
      {extra && <span style={{ marginLeft: 2, fontSize: 10.5 }}>{extra}</span>}
    </span>
  );

  return (
    <button
      onClick={() => { if (fired.current) { fired.current = false; return; } onOpen(); }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onPointerMove={move}
      onContextMenu={(e) => { if (onLongPress) e.preventDefault(); }}
      style={{
        all: 'unset', boxSizing: 'border-box', display: 'block', width: 'calc(100% + 16px)', cursor: 'pointer',
        // 음영이 행 폭 끝까지 차도록 좌우 8px 확장. 왼쪽 18px = 노트 점(6~12px)이 음영 안에 온전히 들어가는 여백
        margin: '0 -8px', padding: '13px 10px 13px 18px', background: TIER_BG[stockTierOf(row, storeKey)],
        borderBottom: '1px solid var(--border-subtle)',
        // 롱프레스 시 iOS 텍스트 선택/콜아웃 억제
        WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', position: 'relative',
      } as React.CSSProperties}>
      {/* 테이스팅 노트 있음 = 이름 앞 골드 점. 행 왼쪽 여백 안에 둬 이름·빈티지 정렬 유지.
          롱프레스(노트 열기)가 가능한 행과 같은 조건 */}
      {onLongPress && (
        <i aria-label="테이스팅 노트 있음" style={{
          position: 'absolute', left: 6, top: 21, width: 6, height: 6, borderRadius: '50%', background: GOLD,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: soldOutEverywhere ? 'var(--text-tertiary)' : 'var(--text-primary)',
        }}>
          {row.item_name}
        </span>
        {row.sale_price > 0 && (
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {row.discount_rate > 0 && (
              <span style={{ marginRight: 6, fontSize: 11.5, fontWeight: 400, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                {fmt(row.retail_price)}
              </span>
            )}
            {fmt(row.sale_price)}
          </span>
        )}
        {onAlert ? (
          <AlertBell on={!!alerted} onToggle={onAlert} />
        ) : onAdd && (
          <span role="button" aria-label="정산에 담기"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: 'none', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--surface)',
              fontSize: 17, lineHeight: 1, color: 'var(--text-primary)', cursor: 'pointer',
            }}>
            +
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {/* 빈티지 — 둘째 줄 맨 앞 고정 열(행마다 같은 x 위치라 훑어보기 쉬움) */}
        {row.vintage && (
          <span style={{
            flex: 'none', minWidth: 36, paddingRight: 12, borderRight: '1px solid var(--border-subtle)',
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
          }}>
            {row.vintage}
          </span>
        )}
        {cell('매장', mine, mine > 0 ? 'ok' : 'zero')}
        {cell('본사', row.hq_available, row.hq_available > 0 ? 'ok' : 'zero')}
        {(row.arrival_btls > 0 || row.incoming > 0) &&
          cell('입고', row.arrival_btls || row.incoming, 'warn',
            row.arrival_date ? arrivalSuffix(row.arrival_date, row.hq_bonded) : undefined)}
      </div>
    </button>
  );
}
