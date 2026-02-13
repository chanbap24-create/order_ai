'use client';

import type { TabId } from '@/app/types/wine';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'upload', label: '데이터 업로드', icon: '📤' },
  { id: 'client-analysis', label: '매출분석', icon: '📈' },
  { id: 'dashboard', label: '재고분석', icon: '📊' },
  { id: 'all-wines', label: '와인리스트', icon: '🗂️' },
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
      marginBottom: 24,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div className="ds-tab-group" style={{ display: 'inline-flex', width: 'auto' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`ds-tab${isActive ? ' active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              style={{ gap: 6 }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'new-wine' && newWineCount != null && newWineCount > 0 && (
                <span style={{
                  background: '#dc3545',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: 99,
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
    </div>
  );
}
