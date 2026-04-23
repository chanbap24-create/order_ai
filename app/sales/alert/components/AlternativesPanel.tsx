'use client';

import type { Alternative } from '../types';
import { LEVEL_COLORS } from '../constants';
import { fmt } from '../lib/format';

type Props = {
  alternatives: Alternative[];
  altLoading: boolean;
  altSelected: Set<string>;
  onToggleAlt: (itemNo: string) => void;
  quoteLoading: boolean;
  quoteMsg: string | null;
  onAddToQuote: () => void;
};

export function AlternativesPanel(p: Props) {
  return (
    <div style={{ borderTop: '1px solid #f0f0f0', padding: '14px', background: '#f9f6f2' }}>
      {p.altLoading ? (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#a8a098' }}>
          대체 와인을 찾는 중...
        </div>
      ) : p.alternatives.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#a8a098' }}>
          유사한 대체 와인을 찾을 수 없습니다.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A1515', marginBottom: 10 }}>
            대체 추천 ({p.alternatives.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.alternatives.map(alt => (
              <AltCard
                key={alt.item_no}
                alt={alt}
                checked={p.altSelected.has(alt.item_no)}
                onClick={() => p.onToggleAlt(alt.item_no)}
              />
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={p.onAddToQuote}
              disabled={p.altSelected.size === 0 || p.quoteLoading}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: p.altSelected.size === 0 ? '#ddd' : '#5A1515',
                color: 'white', fontSize: 12, fontWeight: 600,
                cursor: p.altSelected.size === 0 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              {p.quoteLoading ? '추가 중...' : `견적서에 추가 (${p.altSelected.size})`}
            </button>
            {p.quoteMsg && (
              <span style={{
                fontSize: 12,
                color: p.quoteMsg.includes('오류') ? '#dc3545' : '#4CAF50',
                fontWeight: 500,
              }}>
                {p.quoteMsg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AltCard({ alt, checked, onClick }: { alt: Alternative; checked: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: 8, padding: '10px 12px',
        border: checked ? '2px solid #5A1515' : '1px solid rgba(90,21,21,0.08)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810', lineHeight: 1.3 }}>
            {alt.item_name || alt.item_no}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 11, color: '#8a8580' }}>
            <span>{alt.item_no}</span>
            {alt.country && <span>{alt.country}</span>}
            {alt.region && <span>{alt.region}</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 4,
              background: LEVEL_COLORS[alt.match_level] || '#666',
              color: 'white', fontWeight: 600,
            }}>
              {alt.match_label}
            </span>
            {alt.match_reasons
              .filter(r => !alt.match_label.includes(r.replace('같은 ', '')))
              .map((reason, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: '#fef3e2', color: '#e65100', fontWeight: 500,
                }}>
                  {reason}
                </span>
              ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810' }}>
            {fmt(alt.price)}원
          </div>
          <div style={{ fontSize: 11, color: '#4CAF50', marginTop: 2 }}>
            재고 {alt.stock}
          </div>
        </div>
      </div>
    </div>
  );
}
