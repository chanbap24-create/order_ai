'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { TabId } from '@/app/types/wine';
import AdminTabs from './components/AdminTabs';
import AdminLoginCard from './components/AdminLoginCard';
import UploadTab from './components/UploadTab';
import '@/app/styles/design-system.css';

const tabLoader = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>로딩 중...</div>
);

const DashboardTab = dynamic(() => import('./components/DashboardTab'), { ssr: false, loading: tabLoader });
const NewWineTab = dynamic(() => import('./components/NewWineTab'), { ssr: false, loading: tabLoader });
const AllWinesTab = dynamic(() => import('./components/AllWinesTab'), { ssr: false, loading: tabLoader });
const TastingNoteTab = dynamic(() => import('./components/TastingNoteTab'), { ssr: false, loading: tabLoader });
const ClientAnalysisTab = dynamic(() => import('./components/ClientAnalysisTab'), { ssr: false, loading: tabLoader });
const RecommendSettingsTab = dynamic(() => import('./components/RecommendSettingsTab'), { ssr: false, loading: tabLoader });
const WineRegionsTab = dynamic(() => import('./components/WineRegionsTab'), { ssr: false, loading: tabLoader });
const BrandTab = dynamic(() => import('./components/BrandTab'), { ssr: false, loading: tabLoader });
const CompanyEventsTab = dynamic(() => import('./components/CompanyEventsTab'), { ssr: false, loading: tabLoader });
const ImportForecastTab = dynamic(() => import('./components/ImportForecastTab'), { ssr: false, loading: tabLoader });
const FeatureUsageTab = dynamic(() => import('./components/FeatureUsageTab'), { ssr: false, loading: tabLoader });

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [newWineCount, setNewWineCount] = useState<number>(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  // 기존 세션 확인
  useEffect(() => {
    fetch('/api/auth/admin-login')
      .then(r => r.json())
      .then(d => { if (d.authenticated) setAuthenticated(true); })
      .catch(() => {})
      .finally(() => setAuthChecking(false));
  }, []);

  const handleLogin = async () => {
    if (pin.length < 1) return;
    setLoginLoading(true);
    setError(false);
    try {
      // MFA 2단계: mfaRequired 상태면 totp/backup 함께 전송
      const body: Record<string, string> = { password: pin };
      if (mfaRequired) {
        if (useBackupCode) body.backup_code = mfaCode;
        else body.totp = mfaCode;
      }
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setAuthenticated(true);
        // MFA 첫 설정 유도
        if (data.mfa_setup_needed) {
          setTimeout(() => {
            if (confirm('보안 강화를 위해 2단계 인증(TOTP)을 설정해주세요. 지금 설정 페이지로 이동하시겠습니까?')) {
              window.location.href = '/admin/mfa-setup';
            }
          }, 500);
        }
      } else if (data.mfa_required) {
        // 1단계 통과 → MFA 입력 요구
        setMfaRequired(true);
        setMfaError('');
        setMfaCode('');
      } else {
        if (mfaRequired) {
          setMfaError(data.error || 'MFA 코드가 틀렸습니다.');
          setMfaCode('');
        } else {
          setError(true);
          setPin('');
        }
      }
    } catch {
      if (mfaRequired) setMfaError('네트워크 오류');
      else { setError(true); setPin(''); }
    } finally {
      setLoginLoading(false);
    }
  };

  // DB에서 실제 status='new' 와인 수 조회
  const fetchNewWineCount = async () => {
    try {
      const res = await fetch('/api/admin/wines?status=new');
      const data = await res.json();
      if (data.success) setNewWineCount(data.data?.length || 0);
    } catch { /* ignore */ }
  };

  // 인증 완료 후 신규 와인 수 로드
  useEffect(() => {
    if (authenticated) fetchNewWineCount();
  }, [authenticated]);

  // 업로드 완료 시 신규 와인 수 갱신
  const handleUploadComplete = (type: string, _result: Record<string, unknown>) => {
    if (type === 'downloads') {
      fetchNewWineCount();
    }
  };

  if (authChecking) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-muted)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>인증 확인 중...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminLoginCard
        pin={pin} setPin={setPin}
        error={error} setError={setError}
        loginLoading={loginLoading}
        mfaRequired={mfaRequired} setMfaRequired={setMfaRequired}
        mfaCode={mfaCode} setMfaCode={setMfaCode}
        mfaError={mfaError} setMfaError={setMfaError}
        useBackupCode={useBackupCode} setUseBackupCode={setUseBackupCode}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'var(--surface-muted)',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div
        className="admin-container"
        style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}
      >
        <style>{`
          @media (max-width: 768px) {
            .admin-container { padding: 16px 12px !important; }
          }
        `}</style>
        {/* Header — PageHeader 패턴 (Sales 와 동일) */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          paddingBottom: 16,
          marginBottom: 20,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.5rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              letterSpacing: '0.01em',
              lineHeight: 1.3,
              margin: 0,
            }}>Admin</h1>
            <div style={{
              width: 32,
              height: 2,
              marginTop: 10,
              background: 'linear-gradient(90deg, var(--action) 0%, transparent 100%)',
              borderRadius: 1,
            }} />
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
            <a
              href="/admin/password"
              style={{
                height: 28,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--surface)',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >비밀번호</a>
            <a
              href="/admin/mfa-setup"
              style={{
                height: 28,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--surface)',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >MFA</a>
          </div>
        </header>

        {/* 탭 바 */}
        <AdminTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          newWineCount={newWineCount}
        />

        {/* 탭 콘텐츠 */}
        {activeTab === 'upload' && <UploadTab onUploadComplete={handleUploadComplete} />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'new-wine' && <NewWineTab />}
        {activeTab === 'all-wines' && <AllWinesTab />}
        {activeTab === 'tasting-note' && <TastingNoteTab />}
        {activeTab === 'client-analysis' && <ClientAnalysisTab />}
        {activeTab === 'recommend-settings' && <RecommendSettingsTab />}
        {activeTab === 'wine-regions' && <WineRegionsTab />}
        {activeTab === 'brand-library' && <BrandTab />}
        {activeTab === 'company-events' && <CompanyEventsTab />}
        {activeTab === 'import-forecast' && <ImportForecastTab />}
        {activeTab === 'feature-usage' && <FeatureUsageTab />}
      </div>

      {/* Toast container */}
      <style>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
