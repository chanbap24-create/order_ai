'use client';

import { useState } from 'react';
import { fmt } from '../lib/format';
import { QuoteColumnsMenu } from './QuoteColumnsMenu';

type Props = {
  selectedCount: number;
  selectedTotal: number;
  quoteLoading: boolean;
  onAdd: () => void;
  onDownload: () => void;
  quoteCols: string[];
  toggleCol: (k: string) => void;
  resetCols: () => void;
};

export function BottomActionBar(p: Props) {
  const [showColSettings, setShowColSettings] = useState(false);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1.5px solid rgba(90,21,21,0.08)',
      padding: '12px 16px', zIndex: 200,
      boxShadow: '0 -2px 10px rgba(90,21,21,0.05)',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {p.selectedCount}개 선택
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            예상 합계: {fmt(p.selectedTotal)}원
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColSettings(v => !v)}
            style={{
              width: 36, height: 36, borderRadius: 8, border: '1px solid #ddd',
              background: showColSettings ? '#f5f0eb' : '#fff', color: 'var(--action)',
              fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="컬럼 설정"
          >
            ⚙
          </button>
          {showColSettings && (
            <QuoteColumnsMenu
              quoteCols={p.quoteCols}
              toggle={p.toggleCol}
              reset={p.resetCols}
              onClose={() => setShowColSettings(false)}
            />
          )}
        </div>
        <button
          onClick={p.onAdd}
          disabled={p.quoteLoading}
          style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid var(--action)',
            background: '#fff', color: 'var(--action)', fontSize: 13, fontWeight: 600,
            cursor: p.quoteLoading ? 'default' : 'pointer',
          }}
        >
          견적서에 추가
        </button>
        <button
          onClick={p.onDownload}
          disabled={p.quoteLoading}
          style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: p.quoteLoading ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: p.quoteLoading ? 'default' : 'pointer',
          }}
        >
          {p.quoteLoading ? '처리 중...' : '견적서 생성'}
        </button>
      </div>
    </div>
  );
}
