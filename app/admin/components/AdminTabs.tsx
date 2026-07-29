'use client';

import type { TabId } from '@/app/types/wine';

const TABS: { id: TabId; label: string }[] = [
  { id: 'upload', label: '업로드' },
  { id: 'client-analysis', label: '매출분석' },
  { id: 'segments', label: '업장추천' },
  { id: 'dashboard', label: '재고분석' },
  { id: 'all-wines', label: '와인리스트' },
  { id: 'tasting-note', label: '테이스팅노트' },
  { id: 'flavor-tags', label: '향미태그' },
  { id: 'wine-regions', label: '와인산지DB' },
  { id: 'brand-library', label: '브랜드자료실' },
  { id: 'glass-images', label: '글라스이미지' },
  { id: 'company-events', label: '회사일정' },
  { id: 'import-forecast', label: '수입량예측' },
  { id: 'feature-usage', label: '사용량' },
  { id: 'parse-stats', label: '발주AI' },
  { id: 'sommelier', label: '소믈리에' },
];

interface AdminTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  newWineCount?: number;
}

/**
 * Admin 탭 — SalesTabs 와 동일한 underline 패턴.
 * 페이지를 넘겨도 같은 디자인 언어를 유지.
 */
export default function AdminTabs({ activeTab, onTabChange, newWineCount }: AdminTabsProps) {
  return (
    <div
      className="admin-tabs-bar"
      style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 20,
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .admin-tab-btn { padding: 8px 10px !important; font-size: 12px !important; }
        }
      `}</style>
      <div style={{ display: 'inline-flex', gap: 4 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="admin-tab-btn"
              onClick={() => onTabChange(tab.id)}
              style={{
                position: 'relative',
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--action)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
              }}
            >
              {tab.label}
              {tab.id === 'tasting-note' && newWineCount != null && newWineCount > 0 && (
                <span
                  style={{
                    background: 'var(--status-danger)',
                    color: 'var(--text-on-primary)',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 99,
                    padding: '1px 6px',
                    minWidth: 16,
                    textAlign: 'center',
                    lineHeight: '14px',
                  }}
                >
                  {newWineCount}
                </span>
              )}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: 'var(--action)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
