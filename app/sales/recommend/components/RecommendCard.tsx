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

export function RecommendCard({ item, isSelected, onToggle }: Props) {
  const sc = scoreColor(item.score);
  const [showBreak, setShowBreak] = useState(false); // 기본 접힘(카드 높이 축소)
  const brief = briefFromBreakdown(item.breakdown);
  // 거래처 이력 기반(개인화) vs 동종업장·일반 기반(세그먼트) — 통합 스코어러가 큰 축으로 라벨 태그를 붙임
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
        background: '#fff', borderRadius: 10, padding: '12px 14px',
        border: isSelected ? '2px solid var(--action)' : '1px solid var(--action-muted)',
        boxShadow: isSelected ? '0 0 0 1px rgba(90,21,21,0.1)' : '0 1px 2px rgba(90,21,21,0.03)',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: isSelected ? '2px solid var(--action)' : '2px solid rgba(90,21,21,0.12)',
        background: isSelected ? 'var(--action)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
      }}>
        {isSelected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* 왼쪽: 병 이미지 + 기반 배지(밑으로 이동 → 세로 축소) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, width: 54 }}>
        <div style={{
          width: 44, height: 56, borderRadius: 6, overflow: 'hidden',
          background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>이미지</span>
          )}
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, padding: '2px 3px', borderRadius: 5, width: '100%',
          textAlign: 'center', lineHeight: 1.15, wordBreak: 'keep-all',
          background: isClientBased ? 'rgba(21,101,52,0.13)' : 'rgba(180,110,20,0.16)',
          color: isClientBased ? '#166534' : '#9a5b00',
          border: `1px solid ${isClientBased ? 'rgba(21,101,52,0.3)' : 'rgba(180,110,20,0.35)'}`,
        }}>
          {isClientBased ? '🎯 거래처이력' : '🏢 동종업장'}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: sc, minWidth: 30 }}>{item.score}점</span>
          <span style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.item_name}
          </span>
        </div>
        {meta && (
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {meta}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {item.tags.filter((t) => t !== '거래처이력' && t !== '동종업장').map((tag) => (
            <span key={tag} style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: `${TAG_COLORS[tag] || 'var(--neutral-100)'}18`,
              color: TAG_COLORS[tag] || 'var(--neutral-100)', fontWeight: 600,
            }}>
              {tag}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.reason}</div>

        {item.breakdown && item.breakdown.length > 0 && (
          <div style={{ marginTop: 5 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowBreak(!showBreak)}
                style={{
                  fontSize: 11, color: 'var(--action)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, fontWeight: 600, flexShrink: 0,
                }}
              >
                {showBreak ? '▾' : '▸'} 점수 분해
              </button>
              {/* 접힘 상태: 컬럼별 간단 점수 */}
              {!showBreak && brief.map((b, i) => (
                <span key={i} style={{
                  fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace',
                  background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: 6,
                }}>{b}</span>
              ))}
            </div>
            {showBreak && (
              <div style={{
                marginTop: 4, padding: '6px 10px', borderRadius: 6,
                background: 'var(--surface-muted)', border: '1px solid var(--gray-100)',
                fontFamily: 'ui-monospace, monospace',
              }}>
                {item.breakdown.map((line, i) => {
                  const isTotal = line.startsWith('=');
                  return (
                    <div key={i} style={{
                      fontSize: 11.5, lineHeight: 1.7,
                      color: isTotal ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isTotal ? 700 : 400,
                      borderTop: isTotal ? '1px solid var(--gray-200)' : 'none',
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

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {item.price ? item.price.toLocaleString() + '원' : '-'}
        </div>
        {item.rec_discount ? (
          <div style={{ fontSize: 11, color: 'var(--action)', marginTop: 1, fontWeight: 600 }}>
            권장 {Math.round(item.rec_discount * 100)}% → {Math.round(item.price * (1 - item.rec_discount)).toLocaleString()}원
          </div>
        ) : null}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>재고 {item.stock || 0}</div>
        {item.buy_count !== undefined && (
          <div style={{ fontSize: 11, color: '#2196F3', marginTop: 1, fontWeight: 500 }}>
            {item.buy_count}회 구매
          </div>
        )}
      </div>
    </div>
  );
}
