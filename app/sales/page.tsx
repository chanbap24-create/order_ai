'use client';

import { useCallback, useState } from 'react';
import SalesTabs from './components/SalesTabs';
import type { SalesTabId } from './components/SalesTabs';
import { useSalesAuth } from './page-auth/hooks/useSalesAuth';
import { LoginCard } from './page-auth/components/LoginCard';
import { PasswordChangePanel } from './page-auth/components/PasswordChangePanel';
import { Header } from './page-auth/components/Header';
import { TabContent } from './page-auth/components/TabContent';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTabId>('meetings');
  const [alertCount, setAlertCount] = useState(0);
  const [showPwChange, setShowPwChange] = useState(false);
  const handleAlertCountChange = useCallback((count: number) => setAlertCount(count), []);

  const auth = useSalesAuth(setActiveTab);

  const handleLogout = async () => {
    try { await fetch('/api/auth/login', { method: 'DELETE' }); } catch { /* ignore */ }
    auth.logoutLocal();
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
      background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
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
        />
      </div>
    </div>
  );
}
