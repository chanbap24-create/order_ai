'use client';

import type { TabId } from '@/app/types/wine';

const TABS: { id: TabId; label: string }[] = [
  { id: 'upload', label: '업로드' },
  { id: 'client-analysis', label: '매출분석' },
  { id: 'dashboard', label: '재고분석' },
  { id: 'all-wines', label: '와인리스트' },
  { id: 'new-wine', label: '신규와인' },
  { id: 'tasting-note', label: '테이스팅노트' },
  { id: 'price-list', label: '가격리스트' },
  { id: 'change-log', label: '변경이력' },
  { id: 'recommend-settings', label: 'AI추천설정' },
  { id: 'wine-regions', label: '와인산지DB' },
  { id: 'brand-library', label: '브랜드자료실' },
  { id: 'company-events', label: '회사일정' },
];

interface AdminTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  newWineCount?: number;
}

export default function AdminTabs({ activeTab, onTabChange, newWineCount }: AdminTabsProps) {
  return (
    <div style={{
      marginBottom: 24,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        display: 'inline-flex',
        background: 'rgba(90,21,21,0.05)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? '#5A1515' : '#8a8580',
                boxShadow: isActive ? '0 1px 4px rgba(90,21,21,0.1), 0 0 0 1px rgba(90,21,21,0.04)' : 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {tab.label}
              {tab.id === 'new-wine' && newWineCount != null && newWineCount > 0 && (
                <span style={{
                  background: '#dc3545',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 99,
                  padding: '1px 6px',
                  minWidth: 16,
                  textAlign: 'center',
                  lineHeight: '14px',
                }}>
                  {newWineCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
