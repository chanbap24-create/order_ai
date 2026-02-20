'use client';

export type SalesTabId = 'meetings' | 'briefing' | 'actions' | 'analysis' | 'alerts';

const TABS: { id: SalesTabId; label: string; icon: string }[] = [
  { id: 'meetings', label: '미팅', icon: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18' },
  { id: 'briefing', label: '브리핑', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id: 'actions', label: '액션', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8' },
  { id: 'alerts', label: '알림', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
  { id: 'analysis', label: '분석', icon: 'M18 20V10M12 20V4M6 20v-6' },
];

interface SalesTabsProps {
  activeTab: SalesTabId;
  onTabChange: (tab: SalesTabId) => void;
  alertCount?: number;
  actionCount?: number;
}

export default function SalesTabs({ activeTab, onTabChange, alertCount, actionCount }: SalesTabsProps) {
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
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? '#5A1515' : '#8a8580',
                boxShadow: isActive ? '0 1px 4px rgba(90,21,21,0.1), 0 0 0 1px rgba(90,21,21,0.04)' : 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                letterSpacing: '0.01em',
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
              {tab.id === 'actions' && actionCount != null && actionCount > 0 && (
                <span style={{
                  background: '#E65100',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 99,
                  padding: '1px 6px',
                  minWidth: 16,
                  textAlign: 'center',
                  lineHeight: '14px',
                }}>
                  {actionCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
