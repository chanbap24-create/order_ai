'use client';

export type SalesTabId = 'clients' | 'recommend' | 'meetings' | 'briefing' | 'analysis' | 'alerts';

const TABS: { id: SalesTabId; label: string; icon: string }[] = [
  { id: 'meetings', label: '미팅', icon: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18' },
  { id: 'briefing', label: '브리핑', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id: 'alerts', label: '알림', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
  { id: 'analysis', label: '분석', icon: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'recommend', label: 'AI 추천', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'clients', label: '거래처', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
];

interface SalesTabsProps {
  activeTab: SalesTabId;
  onTabChange: (tab: SalesTabId) => void;
  alertCount?: number;
}

export default function SalesTabs({ activeTab, onTabChange, alertCount }: SalesTabsProps) {
  return (
    <div style={{
      marginBottom: 24,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        display: 'inline-flex',
        background: '#F0EFED',
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? '#5A1515' : '#999',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              {tab.label}
              {tab.id === 'alerts' && alertCount != null && alertCount > 0 && (
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
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
