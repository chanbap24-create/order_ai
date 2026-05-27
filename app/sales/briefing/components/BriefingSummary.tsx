'use client';

import type { BriefingData } from '../types';
import { IMPORTANCE_LABELS, TAG_COLORS } from '../constants';
import { fmt } from '../lib/format';

export function BriefingSummary({ briefing }: { briefing: BriefingData }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {briefing.client_summary.importance && IMPORTANCE_LABELS[briefing.client_summary.importance] && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: `${IMPORTANCE_LABELS[briefing.client_summary.importance].color}18`,
            color: IMPORTANCE_LABELS[briefing.client_summary.importance].color,
          }}>
            {IMPORTANCE_LABELS[briefing.client_summary.importance].label}
          </span>
        )}
        {(briefing.client_summary.yearly_revenue ?? 0) > 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            올해 매출 {fmt(briefing.client_summary.yearly_revenue!)}원
          </span>
        )}
        {briefing.avg_discount_rate != null && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 6,
            background: '#fff3e0', color: '#e65100', fontWeight: 600,
          }}>
            평균 지원 {briefing.avg_discount_rate}%
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>총 구매</div>
          <div style={{ fontWeight: 700 }}>{briefing.client_summary.total_purchases}건</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>평균 단가</div>
          <div style={{ fontWeight: 700 }}>{fmt(briefing.client_summary.avg_price)}원</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>최근 주문</div>
          <div style={{ fontWeight: 700 }}>{briefing.client_summary.last_order_date || '-'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>추세</div>
          <div style={{
            fontWeight: 700,
            color: briefing.client_summary.trend === 'up' ? '#2E7D32'
              : briefing.client_summary.trend === 'down' ? '#c62828' : '#666',
          }}>
            {briefing.client_summary.trend === 'up' ? '상승' : briefing.client_summary.trend === 'down' ? '하락' : '유지'}
          </div>
        </div>
      </div>

      {(briefing.client_summary.top_types.length > 0 || briefing.client_summary.top_countries.length > 0) && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {briefing.client_summary.top_types.map(t => (
            <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#e0f2f1', color: '#00897B', fontWeight: 600 }}>{t}</span>
          ))}
          {briefing.client_summary.top_countries.map(c => (
            <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#ede7f6', color: '#7B1FA2', fontWeight: 600 }}>{c}</span>
          ))}
          {briefing.client_summary.top_grapes.slice(0, 3).map(g => (
            <span key={g} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#fce4ec', color: '#c2185b', fontWeight: 600 }}>{g}</span>
          ))}
        </div>
      )}
    </>
  );
}

export function PurchasedItemsList({ items }: { items: BriefingData['purchased_items'] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        구매 품목 ({items.length}건)
      </div>
      {items.slice(0, 10).map((it, i) => (
        <div key={it.item_no} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 0',
          borderBottom: i < Math.min(9, items.length - 1) ? '1px solid rgba(90,21,21,0.06)' : 'none',
          fontSize: 11,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
              {it.item_name}
            </span>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{it.buy_count}회</span>
            <span style={{ fontWeight: 600, color: '#333', minWidth: 50, textAlign: 'right' }}>
              {it.supply_price ? fmt(it.supply_price) + '원' : '-'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecommendationsList({ recommendations }: { recommendations: BriefingData['recommendations'] }) {
  if (recommendations.length === 0) return null;
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        추천 와인 Top {Math.min(5, recommendations.length)}
      </div>
      {recommendations.slice(0, 5).map((r, i) => (
        <div key={r.item_no} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 0', borderBottom: i < Math.min(4, recommendations.length - 1) ? '1px solid rgba(90,21,21,0.06)' : 'none',
          fontSize: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: r.score >= 20 ? '#c62828' : '#888', fontWeight: 600, fontSize: 11 }}>{r.score}점</span>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item_name}</span>
            </div>
            {(r.country || r.grape) && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                {[r.country, r.grape].filter(Boolean).join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
              {r.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{
                  fontSize: 9, padding: '0px 4px', borderRadius: 4,
                  background: `${TAG_COLORS[tag] || '#999'}18`,
                  color: TAG_COLORS[tag] || '#999', fontWeight: 600,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.price ? fmt(r.price) + '원' : '-'}</div>
          </div>
        </div>
      ))}
    </>
  );
}

export function RecentOrdersList({ orders }: { orders: BriefingData['recent_orders'] }) {
  if (orders.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        최근 주문
      </div>
      {orders.slice(0, 3).map((o, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '4px 0', fontSize: 11, color: 'var(--text-tertiary)',
        }}>
          <span>{o.item_name}</span>
          <span>{o.ship_date?.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
