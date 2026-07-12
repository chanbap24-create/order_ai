'use client';

import { useState } from 'react';
import type { ScoredItem } from '../types';
import { TAG_COLORS } from '../constants';
import { scoreColor } from '../lib/format';

type Props = {
  item: ScoredItem;
  isSelected: boolean;
  onToggle: () => void;
};

// 점수 분해(공식)를 컬럼별 간단 점수로 요약 — 접힘 상태 표시용. 펼치면 원본 공식 표시.
function briefFromBreakdown(breakdown?: string[]): string[] {
  if (!breakdown) return [];
  const out: string[] = [];
  for (const line of breakdown) {
    if (line.startsWith('=')) continue;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(?:같은 마을|인근 마을|같은 광역|타지역).*=\s*([\d.]+)\s*$/))) out.push(`산지 ${(+m[1]).toFixed(0)}`);
    else if ((m = line.match(/^품종·향미.*=\s*\+?([\d.]+)/))) out.push(`취향 ${(+m[1]).toFixed(1)}`);
    else if ((m = line.match(/^견적학습\s*\+?([\d.]+)/))) out.push(`견적 ${(+m[1]).toFixed(1)}`);
    else if ((m = line.match(/^(업장|업태|지역) 타입 \+([\d.]+)·국가 \+([\d.]+)/))) out.push(`${m[1]} ${(+m[2] + +m[3]).toFixed(0)}`);
    else if ((m = line.match(/^과거거절\s*[−-]\s*([\d.]+)/))) out.push(`거절 -${m[1]}`);
    else if ((m = line.match(/^비주력타입.*[−-]\s*([\d.]+)\s*$/))) out.push(`비주력 -${m[1]}`);
  }
  return out;
}

/**
 * 추천 상품 행 — KREAM 상품 리스트 문법.
 * 박스 카드 대신 헤어라인 행: [체크] [병 이미지] [이름·메타·상태] [가격(주인공)].
 * 상태(프로모션/기반)는 색 텍스트·도트로만, 선택은 배경 틴트로.
 */
export function RecommendCard({ item, isSelected, onToggle }: Props) {
  const sc = scoreColor(item.score);
  const [showBreak, setShowBreak] = useState(false); // 기본 접힘
  const brief = briefFromBreakdown(item.breakdown);
  // 거래처 이력 기반(개인화) vs 동종업장·일반 기반(세그먼트)
  const isClientBased = !item.tags?.includes('동종업장');
  // 견적서 화면과 동일한 메타: 국가 · 브랜드 · 빈티지 · 산지 · 품종
  const meta = [item.country, item.brand, item.vintage, item.region, item.grape]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '13px 4px',
        borderBottom: '1px solid var(--border-subtle)',
        background: isSelected ? 'var(--surface-active)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'var(--surface-active)' : 'transparent';
      }}
    >
      {/* 체크 */}
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
        border: isSelected ? '2px solid var(--action)' : '2px solid var(--border-strong)',
        background: isSelected ? 'var(--action)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isSelected && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* 병 이미지 */}
      <div style={{
        width: 44, height: 56, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
        background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>이미지</span>
        )}
      </div>

      {/* 본문: 이름 → 메타 → 상태 → 점수분해 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2,
        }}>
          {item.item_name}
        </div>
        {meta && (
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {meta}
          </div>
        )}

        {/* 상태 줄 — 칩 다운그레이드: 색 텍스트·도트만 */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
          {item.promo ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>🔥 프로모션</span>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
              color: isClientBased ? 'var(--status-success)' : 'var(--status-warning)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isClientBased ? 'var(--status-success)' : 'var(--status-warning)' }} />
              {isClientBased ? '거래처이력' : '동종업장'}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: sc, fontVariantNumeric: 'tabular-nums' }}>{item.score}점</span>
          {item.tags.filter((t) => t !== '거래처이력' && t !== '동종업장' && t !== '프로모션').map((tag) => (
            <span key={tag} style={{ fontSize: 10.5, fontWeight: 600, color: TAG_COLORS[tag] || 'var(--text-tertiary)' }}>
              {tag}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{item.reason}</div>

        {item.breakdown && item.breakdown.length > 0 && (
          <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowBreak(!showBreak)}
                style={{
                  fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, fontWeight: 600, flexShrink: 0,
                }}
              >
                {showBreak ? '▾' : '▸'} 점수 분해
              </button>
              {/* 접힘 상태: 컬럼별 간단 점수 */}
              {!showBreak && brief.map((b, i) => (
                <span key={i} style={{
                  fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace',
                  background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: 4,
                }}>{b}</span>
              ))}
            </div>
            {showBreak && (
              <div style={{
                marginTop: 4, padding: '6px 10px', borderRadius: 6,
                background: 'var(--surface-muted)',
                fontFamily: 'ui-monospace, monospace',
              }}>
                {item.breakdown.map((line, i) => {
                  const isTotal = line.startsWith('=');
                  return (
                    <div key={i} style={{
                      fontSize: 11.5, lineHeight: 1.7,
                      color: isTotal ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isTotal ? 700 : 400,
                      borderTop: isTotal ? '1px solid var(--border-default)' : 'none',
                      marginTop: isTotal ? 3 : 0, paddingTop: isTotal ? 3 : 0,
                    }}>
                      {line}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 우측: 가격이 주인공 */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {item.price ? item.price.toLocaleString() + '원' : '-'}
        </div>
        {item.rec_discount ? (
          <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 1, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            권장 {Math.round(item.rec_discount * 100)}% → {Math.round(item.price * (1 - item.rec_discount)).toLocaleString()}원
          </div>
        ) : null}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>재고 {item.stock || 0}</div>
        {item.buy_count !== undefined && (
          <div style={{ fontSize: 11, color: 'var(--status-info)', marginTop: 1, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {item.buy_count}회 구매
          </div>
        )}
      </div>
    </div>
  );
}
