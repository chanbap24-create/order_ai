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
    <div
      style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '14px 16px',
        background: 'var(--surface-muted)',
      }}
    >
      {p.altLoading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          대체 와인을 찾는 중...
        </div>
      ) : p.alternatives.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          유사한 대체 와인을 찾을 수 없습니다.
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--action)',
              marginBottom: 10,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            대체 추천 ({p.alternatives.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.alternatives.map((alt) => (
              <AltCard
                key={alt.item_no}
                alt={alt}
                checked={p.altSelected.has(alt.item_no)}
                onClick={() => p.onToggleAlt(alt.item_no)}
              />
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={p.onAddToQuote}
              disabled={p.altSelected.size === 0 || p.quoteLoading}
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid var(--action)',
                background:
                  p.altSelected.size === 0 ? 'var(--action-muted)' : 'var(--action)',
                color:
                  p.altSelected.size === 0 ? 'var(--text-muted)' : 'var(--text-on-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: p.altSelected.size === 0 ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {p.quoteLoading ? '추가 중...' : `견적서에 추가 (${p.altSelected.size})`}
            </button>
            {p.quoteMsg && (
              <span
                style={{
                  fontSize: 12,
                  color: p.quoteMsg.includes('오류') ? 'var(--status-danger)' : 'var(--status-success)',
                  fontWeight: 600,
                }}
              >
                {p.quoteMsg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AltCard({
  alt,
  checked,
  onClick,
}: {
  alt: Alternative;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        borderRadius: 8,
        padding: '10px 12px',
        border: `1px solid ${checked ? 'var(--action)' : 'var(--border-default)'}`,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 0.12s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            {alt.item_name || alt.item_no}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 4,
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{alt.item_no}</span>
            {alt.country && <span>{alt.country}</span>}
            {alt.region && <span>{alt.region}</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: LEVEL_COLORS[alt.match_level] || 'var(--text-tertiary)',
                color: 'var(--text-on-primary)',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {alt.match_label}
            </span>
            {alt.match_reasons
              .filter((r) => !alt.match_label.includes(r.replace('같은 ', '')))
              .map((reason, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: '#fef3e2',
                    color: 'var(--status-warning)',
                    fontWeight: 600,
                  }}
                >
                  {reason}
                </span>
              ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmt(alt.price)}원
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-success)', marginTop: 2, fontWeight: 600 }}>
            재고 {alt.stock}
          </div>
        </div>
      </div>
    </button>
  );
}
