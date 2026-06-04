'use client';

import type { BriefingData, Meeting } from '../types';
import { IMPORTANCE_LABELS, MEETING_TYPES, STATUS_MAP } from '../constants';
import {
  BriefingSummary,
  PurchasedItemsList,
  RecommendationsList,
  RecentOrdersList,
} from './BriefingSummary';
import { QuoteColumnsMenu } from './QuoteColumnsMenu';

type Props = {
  meeting: Meeting;
  isExpanded: boolean;
  generating: boolean;
  onToggleExpand: () => void;
  onGenerate: () => void;
  quoteLoading: boolean;
  onCreateQuote: (m: Meeting, briefing: BriefingData) => void;
  quoteCols: string[];
  toggleCol: (k: string) => void;
  resetCols: () => void;
  showColSettings: boolean;
  onToggleColSettings: () => void;
  onCloseColSettings: () => void;
};

export function MeetingCard(p: Props) {
  const { meeting: m, isExpanded, generating, onToggleExpand, onGenerate } = p;
  const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
  const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
  const briefing = m.ai_briefing as BriefingData | null;
  const hasBriefing = !!briefing;

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: hasBriefing ? '1px solid #c8e6c9' : '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 1px 3px rgba(90,21,21,0.03)',
      overflow: 'hidden',
    }}>
      <MeetingCardHeader
        meeting={m}
        mt={mt}
        st={st}
        hasBriefing={hasBriefing}
        generating={generating}
        onToggleExpand={onToggleExpand}
        onGenerate={onGenerate}
      />

      {isExpanded && briefing && (
        <div style={{
          borderTop: '1px solid rgba(90,21,21,0.06)', padding: '14px',
          background: '#fafaf8',
        }}>
          <BriefingSummary briefing={briefing} />
          <PurchasedItemsList items={briefing.purchased_items} />

          {briefing.recommendations.length > 0 && (
            <div>
              <RecommendationsList recommendations={briefing.recommendations} />
              <QuoteActions
                meeting={m}
                briefing={briefing}
                quoteLoading={p.quoteLoading}
                onCreateQuote={p.onCreateQuote}
                quoteCols={p.quoteCols}
                toggleCol={p.toggleCol}
                resetCols={p.resetCols}
                showColSettings={p.showColSettings}
                onToggleColSettings={p.onToggleColSettings}
                onCloseColSettings={p.onCloseColSettings}
              />
            </div>
          )}

          <RecentOrdersList orders={briefing.recent_orders} />
        </div>
      )}

      {isExpanded && !briefing && (
        <div style={{
          borderTop: '1px solid rgba(90,21,21,0.06)', padding: '20px 14px',
          textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
        }}>
          브리핑이 아직 생성되지 않았습니다
        </div>
      )}
    </div>
  );
}

function MeetingCardHeader({
  meeting: m, mt, st, hasBriefing, generating, onToggleExpand, onGenerate,
}: {
  meeting: Meeting;
  mt: { label: string; color: string };
  st: { label: string; color: string; bg: string };
  hasBriefing: boolean;
  generating: boolean;
  onToggleExpand: () => void;
  onGenerate: () => void;
}) {
  return (
    <div onClick={onToggleExpand} style={{
      padding: '12px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 44, flexShrink: 0, textAlign: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--action)',
      }}>
        {m.meeting_time || '--:--'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          {m.client_name}
          {m.client_importance && IMPORTANCE_LABELS[m.client_importance] && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
              background: `${IMPORTANCE_LABELS[m.client_importance].color}18`,
              color: IMPORTANCE_LABELS[m.client_importance].color,
            }}>
              {IMPORTANCE_LABELS[m.client_importance].label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 8,
            background: `${mt.color}18`, color: mt.color, fontWeight: 600,
          }}>
            {mt.label}
          </span>
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 8,
            background: st.bg, color: st.color, fontWeight: 600,
          }}>
            {st.label}
          </span>
          {m.purpose && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.purpose}</span>}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {hasBriefing ? (
          <div style={{
            width: 28, height: 28, borderRadius: 14, background: 'var(--status-success-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="var(--status-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            disabled={generating}
            style={{
              padding: '5px 10px', borderRadius: 6, border: 'none',
              background: generating ? '#eee' : '#1a237e',
              color: generating ? '#999' : '#fff',
              fontSize: 11, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
            }}
          >
            {generating ? '...' : '생성'}
          </button>
        )}
      </div>
    </div>
  );
}

function QuoteActions({
  meeting: m, briefing, quoteLoading, onCreateQuote,
  quoteCols, toggleCol, resetCols,
  showColSettings, onToggleColSettings, onCloseColSettings,
}: {
  meeting: Meeting;
  briefing: BriefingData;
  quoteLoading: boolean;
  onCreateQuote: (m: Meeting, b: BriefingData) => void;
  quoteCols: string[];
  toggleCol: (k: string) => void;
  resetCols: () => void;
  showColSettings: boolean;
  onToggleColSettings: () => void;
  onCloseColSettings: () => void;
}) {
  return (
    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={onToggleColSettings}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #ddd',
            background: showColSettings ? '#f5f0eb' : '#fff', color: 'var(--action)',
            fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="컬럼 설정"
        >
          ⚙
        </button>
        {showColSettings && (
          <QuoteColumnsMenu
            quoteCols={quoteCols}
            toggle={toggleCol}
            reset={resetCols}
            onClose={onCloseColSettings}
          />
        )}
      </div>
      <button
        onClick={() => onCreateQuote(m, briefing)}
        disabled={quoteLoading}
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
          background: quoteLoading ? '#ccc' : 'linear-gradient(135deg, var(--action), #8B2252)',
          color: '#fff', fontSize: 12, fontWeight: 600,
          cursor: quoteLoading ? 'default' : 'pointer',
        }}
      >
        {quoteLoading ? '생성 중...' : '추천 와인 견적서 다운로드'}
      </button>
    </div>
  );
}

