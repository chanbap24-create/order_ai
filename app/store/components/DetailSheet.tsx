'use client';

// 품목 상세 바텀시트 — 위치별 병수 + 백화점가 + (우리 매장에 없으면) 대체품. 시안 ③ 화면.
import { corpOfStore, storesOfCorp, type StoreKey, type StoreStockRow } from '@/app/lib/store/types';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function DetailSheet({ row, storeKey, alts, onClose, onNote, onAdd }: {
  row: StoreStockRow; storeKey: StoreKey; alts: StoreStockRow[]; onClose: () => void;
  onNote?: (() => void) | null; // 테이스팅 노트 열기 (있는 품목만)
  onAdd?: () => void;           // 정산에 담기 (POS)
}) {
  const mine = row.stores[storeKey] || 0;
  const corpStores = storesOfCorp(corpOfStore(storeKey)); // 같은 법인 매장만 표시

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '82dvh', overflowY: 'auto', background: 'var(--surface)',
          borderRadius: '18px 18px 0 0', padding: '10px 20px calc(24px + env(safe-area-inset-bottom))',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)', margin: '0 auto 14px' }} />

        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>{row.item_name}</h2>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {row.item_no}{row.vintage ? ` · ${row.vintage}` : ''}
          </span>
          {onNote && (
            <button onClick={onNote}
              style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--action)', border: '1px solid var(--border-default)', borderRadius: 999, padding: '5px 12px' }}>
              테이스팅 노트
            </button>
          )}
        </div>

        {/* 가격 — 정상가 취소선 + 백화점가 크게 */}
        {row.retail_price > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 0 12px', borderBottom: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.sale_price)}</span>
            {row.discount_rate > 0 && (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(row.retail_price)}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-tertiary)' }}>백화점가 {row.discount_rate}% 적용</span>
              </>
            )}
          </div>
        )}

        {/* 위치별 재고 */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {corpStores.map((s) => {
            const n = row.stores[s.key] || 0;
            const isMine = s.key === storeKey;
            return (
              <li key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5 }}>
                <span style={{ color: isMine ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isMine ? 700 : 400 }}>
                  {s.label}{isMine && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--text-tertiary)' }}>우리 매장</span>}
                </span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: n > 0 ? 'var(--status-success)' : 'var(--neutral-400, #c2c4c9)' }}>{n}</span>
              </li>
            );
          })}
          <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>본사 가용</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: row.hq_available > 0 ? 'var(--status-success)' : 'var(--neutral-400, #c2c4c9)' }}>{fmt(row.hq_available)}</span>
          </li>
          {row.hq_bonded > 0 && (
            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5 }}>
              <span style={{ color: 'var(--text-secondary)' }}>보세 <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>통관 전</span></span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--status-warning)' }}>{fmt(row.hq_bonded)}</span>
            </li>
          )}
          {(row.arrival_btls > 0 || row.incoming > 0) && (
            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                들어오는 중{row.arrival_date && <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 6 }}>{row.arrival_date.slice(5, 7)}/{row.arrival_date.slice(8, 10)} 입항</span>}
              </span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--status-warning)' }}>{fmt(row.arrival_btls || row.incoming)}병</span>
            </li>
          )}
        </ul>

        {/* 우리 매장에 없을 때 — 지금 팔 수 있는 대체품 */}
        {mine <= 0 && alts.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '18px 0 6px' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>지금 팔 수 있는 대체품</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>비슷한 와인 · 재고 있음</span>
            </div>
            {alts.map((a) => (
              <div key={a.item_no} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--border-subtle)', minWidth: 0 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.item_name}</span>
                <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {(a.stores[storeKey] || 0) > 0 ? `우리 ${a.stores[storeKey]}` : `본사 ${fmt(a.hq_available)}`}
                  {a.sale_price > 0 ? ` · ${fmt(a.sale_price)}` : ''}
                </span>
              </div>
            ))}
          </>
        )}

        {/* 정산에 담기 — POS 흐름의 진입 */}
        {onAdd && (
          <button onClick={() => { onAdd(); onClose(); }}
            style={{ display: 'block', width: '100%', marginTop: 16, padding: '14px 0', borderRadius: 11, border: 'none', background: 'var(--action)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
            정산에 담기{row.sale_price > 0 ? ` · ${fmt(row.sale_price)}원` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
