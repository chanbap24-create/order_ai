'use client';

import { useState } from 'react';
import { fmt } from '../lib/format';
import { QuoteColumnsMenu } from './QuoteColumnsMenu';

type Props = {
  selectedCount: number;
  selectedTotal: number;
  quoteLoading: boolean;
  onDownload: () => void;
  onDownloadPng?: () => void; // 카톡 전송용 PNG 견적서
  quoteCols: string[];
  toggleCol: (k: string) => void;
  reorderCols?: (next: string[]) => void;
  resetCols: () => void;
};

export function BottomActionBar(p: Props) {
  const [showColSettings, setShowColSettings] = useState(false);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1.5px solid var(--border-default)',
      padding: '12px 16px', zIndex: 200,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
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
              width: 36, height: 36, borderRadius: 8, border: '1px solid var(--gray-300)',
              background: showColSettings ? 'var(--surface-active)' : '#fff', color: 'var(--action)',
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
              reorder={p.reorderCols}
              reset={p.resetCols}
              onClose={() => setShowColSettings(false)}
            />
          )}
        </div>
        {p.onDownloadPng && (
          <button
            onClick={p.onDownloadPng}
            disabled={p.selectedCount === 0}
            title="카톡으로 바로 보낼 수 있는 PNG 견적서 이미지 다운로드"
            style={{
              padding: '10px 14px', borderRadius: 8, border: '1px solid var(--gray-300)',
              background: '#fff', color: p.selectedCount === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: p.selectedCount === 0 ? 'default' : 'pointer',
            }}
          >PNG 견적</button>
        )}
        <button
          onClick={p.onDownload}
          disabled={p.quoteLoading}
          style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: p.quoteLoading ? 'var(--gray-300)' : 'var(--action)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: p.quoteLoading ? 'default' : 'pointer',
          }}
        >
          {p.quoteLoading ? '처리 중...' : '견적 편집에 담기'}
        </button>
      </div>
    </div>
  );
}
