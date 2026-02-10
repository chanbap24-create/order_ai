'use client';

import type { TabId } from '@/app/types/wine';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'upload', label: '데이터 업로드', icon: '📤' },
  { id: 'dashboard', label: '대시보드', icon: '📊' },
  { id: 'new-wine', label: '신규와인', icon: '🍷' },
  { id: 'tasting-note', label: '테이스팅노트', icon: '📝' },
  { id: 'price-list', label: '가격리스트', icon: '💰' },
  { id: 'change-log', label: '변경이력', icon: '📋' },
];

interface AdminTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  newWineCount?: number;
}

export default function AdminTabs({ activeTab, onTabChange, newWineCount }: AdminTabsProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-1)',
      borderBottom: '2px solid var(--color-border)',
      marginBottom: 'var(--space-6)',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: 'var(--space-3) var(--space-5)',
              border: 'none',
              borderBottom: `3px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              background: isActive ? 'rgba(139, 21, 56, 0.06)' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'all var(--transition-fast)',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              position: 'relative',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === 'new-wine' && newWineCount != null && newWineCount > 0 && (
              <span style={{
                background: 'var(--color-error)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
                padding: '1px 7px',
                minWidth: 18,
                textAlign: 'center',
              }}>
                {newWineCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
