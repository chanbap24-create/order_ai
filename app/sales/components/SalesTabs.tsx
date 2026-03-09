'use client';

export type SalesTabId = 'meetings' | 'briefing' | 'shipments' | 'analysis' | 'ledger' | 'item-ledger' | 'outstanding' | 'alerts' | 'expense';

const TABS: { id: SalesTabId; label: string; icon: string }[] = [
  { id: 'meetings', label: '미팅', icon: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18' },
  { id: 'briefing', label: '브리핑', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id: 'shipments', label: '출고현황', icon: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  { id: 'expense', label: '경비', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  { id: 'alerts', label: '알림', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
  { id: 'analysis', label: '분석', icon: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'outstanding', label: '미수현황', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { id: 'ledger', label: '원장', icon: 'M4 2h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM9 2v20M3 7h18M3 12h18M3 17h18' },
  { id: 'item-ledger', label: '품목별', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
];

// executive 계정이 볼 수 있는 탭 (실적 관련만)
const EXEC_TABS: Set<SalesTabId> = new Set(['meetings', 'analysis', 'outstanding', 'ledger', 'item-ledger']);

interface SalesTabsProps {
  activeTab: SalesTabId;
  onTabChange: (tab: SalesTabId) => void;
  alertCount?: number;
  userRole?: string;
}

export default function SalesTabs({ activeTab, onTabChange, alertCount, userRole }: SalesTabsProps) {
  const visibleTabs = userRole === 'executive' ? TABS.filter(t => EXEC_TABS.has(t.id)) : TABS;
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
        {visibleTabs.map((tab) => {
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
