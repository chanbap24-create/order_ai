'use client';

export type SalesTabId =
  | 'meetings' | 'briefing' | 'shipments' | 'client-list' | 'analysis'
  | 'ledger' | 'item-ledger' | 'outstanding' | 'payment-terms' | 'alerts' | 'expense'
  | 'recommend-quote' | 'tasting-approval' | 'promotion';

const TABS: { id: SalesTabId; label: string }[] = [
  { id: 'meetings', label: '미팅' },
  { id: 'briefing', label: '브리핑' },
  { id: 'shipments', label: '출고현황' },
  { id: 'client-list', label: '거래처' },
  { id: 'expense', label: '경비' },
  { id: 'tasting-approval', label: '시음주' },
  { id: 'promotion', label: '프로모션' },
  { id: 'alerts', label: '알림' },
  { id: 'analysis', label: '분석' },
  { id: 'outstanding', label: '미수현황' },
  { id: 'payment-terms', label: '수금일 설정' },
  { id: 'ledger', label: '원장' },
  { id: 'item-ledger', label: '품목별' },
];

const EXEC_TABS: Set<SalesTabId> = new Set([
  'meetings', 'analysis', 'outstanding', 'payment-terms', 'ledger', 'item-ledger',
]);

interface SalesTabsProps {
  activeTab: SalesTabId;
  onTabChange: (tab: SalesTabId) => void;
  alertCount?: number;
  userRole?: string;
}

/**
 * Sales 페이지 탭. underline 패턴 + 동일 typography.
 * 토큰만 사용, 임의값 금지.
 */
export default function SalesTabs({ activeTab, onTabChange, alertCount, userRole }: SalesTabsProps) {
  const visibleTabs = userRole === 'executive' ? TABS.filter((t) => EXEC_TABS.has(t.id)) : TABS;

  return (
    <div
      className="sales-tabs-bar"
      style={{
        background: '#fff',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 24,
      }}
    >
      <style>{`
        .sales-tabs-bar { scrollbar-width: none; }
        .sales-tabs-bar::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .sales-tab-btn { padding: 12px 2px !important; font-size: 13px !important; }
          .sales-tabs-bar > div { gap: 16px !important; }
        }
      `}</style>
      <div style={{ display: 'inline-flex', gap: 22, padding: '0 2px' }}>
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="sales-tab-btn"
              onClick={() => onTabChange(tab.id)}
              style={{
                position: 'relative',
                padding: '14px 2px',
                border: 'none',
                background: 'transparent',
                fontSize: 15,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
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
              {tab.id === 'alerts' && alertCount != null && alertCount > 0 && (
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
                  {alertCount}
                </span>
              )}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2.5,
                    background: 'var(--text-primary)',
                    borderRadius: 2,
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
