'use client';

import { useCallback, useState } from 'react';
import SalesTabs, { TABS } from './components/SalesTabs';
import { IncomingArrivalPopup } from './components/IncomingArrivalPopup';
import type { SalesTabId } from './components/SalesTabs';

// 마지막 탭 기억 — 다른 페이지 갔다 와도 보던 탭 복원 (세션 한정)
const TAB_KEY = 'sales_last_tab';
const savedTab = (): SalesTabId | null => {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    return v && TABS.some((t) => t.id === v) ? (v as SalesTabId) : null;
  } catch { return null; }
};
import { useSalesAuth } from './page-auth/hooks/useSalesAuth';
import { LoginCard } from './page-auth/components/LoginCard';
import { PasswordChangePanel } from './page-auth/components/PasswordChangePanel';
import { Header } from './page-auth/components/Header';
import { TabContent } from './page-auth/components/TabContent';

export default function SalesPage() {
  const [activeTab, setActiveTabState] = useState<SalesTabId>(() => savedTab() ?? 'meetings');
  const [alertCount, setAlertCount] = useState(0);
  const [showPwChange, setShowPwChange] = useState(false);
  const handleAlertCountChange = useCallback((count: number) => setAlertCount(count), []);

  // 탭 변경 시 세션에 저장 (사용자 클릭 기준)
  const setActiveTab = useCallback((t: SalesTabId) => {
    setActiveTabState(t);
    try { sessionStorage.setItem(TAB_KEY, t); } catch { /* ignore */ }
  }, []);
  // 역할 기본 탭(임원→분석 등)은 저장된 탭이 없을 때만 적용 — 보던 탭 복원이 우선
  const setDefaultTab = useCallback((t: SalesTabId) => {
    if (!savedTab()) setActiveTabState(t);
  }, []);

  const auth = useSalesAuth(setDefaultTab);

  const handleLogout = async () => {
    try { await fetch('/api/auth/login', { method: 'DELETE' }); } catch { /* ignore */ }
    try { sessionStorage.removeItem(TAB_KEY); } catch { /* ignore */ }
    auth.logoutLocal();
    setActiveTabState('meetings');
    setAlertCount(0);
    setShowPwChange(false);
  };

  if (auth.authChecking && !auth.authenticated) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 56px)',
        background: 'var(--surface-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>확인 중...</div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return <LoginCard managerList={auth.managerList} onSuccess={auth.acceptLogin} />;
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: '#fff', // KREAM: 순백 페이지 — 카드가 아니라 헤어라인이 구획한다
    }}>
      <div
        className="sales-container"
        style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px' }}
      >
        <style>{`
          @media (max-width: 768px) {
            .sales-container { padding: 16px 12px !important; }
          }
        `}</style>
        <Header
          currentManager={auth.currentManager}
          isAdmin={auth.isAdmin}
          showPwChange={showPwChange}
          onTogglePwChange={() => setShowPwChange(v => !v)}
          onLogout={handleLogout}
        />

        {showPwChange && <PasswordChangePanel onClose={() => setShowPwChange(false)} />}

        <IncomingArrivalPopup />

        <SalesTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          alertCount={alertCount}
          userRole={auth.userRole}
        />

        <TabContent
          activeTab={activeTab}
          currentManager={auth.currentManager}
          isAdmin={auth.isAdmin}
          userRole={auth.userRole}
          userDepartment={auth.userDepartment}
          managerList={auth.managerList}
          onAlertCountChange={handleAlertCountChange}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
