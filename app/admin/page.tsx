'use client';

import { useState, useEffect } from 'react';
import type { TabId } from '@/app/types/wine';
import AdminTabs from './components/AdminTabs';
import UploadTab from './components/UploadTab';
import DashboardTab from './components/DashboardTab';
import NewWineTab from './components/NewWineTab';
import AllWinesTab from './components/AllWinesTab';
import TastingNoteTab from './components/TastingNoteTab';
import PriceListTab from './components/PriceListTab';
import ChangeLogTab from './components/ChangeLogTab';
import ClientAnalysisTab from './components/ClientAnalysisTab';
import RecommendSettingsTab from './components/RecommendSettingsTab';
import WineRegionsTab from './components/WineRegionsTab';
import BrandTab from './components/BrandTab';
import CompanyEventsTab from './components/CompanyEventsTab';
import '@/app/styles/design-system.css';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [newWineCount, setNewWineCount] = useState<number>(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // 기존 세션 확인
  useEffect(() => {
    fetch('/api/auth/admin-login')
      .then(r => r.json())
      .then(d => { if (d.authenticated) setAuthenticated(true); })
      .catch(() => {})
      .finally(() => setAuthChecking(false));
  }, []);

  const handleLogin = async () => {
    if (pin.length < 4) return;
    setLoginLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pin }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
      } else {
        setError(true);
        setPin('');
      }
    } catch {
      setError(true);
      setPin('');
    } finally {
      setLoginLoading(false);
    }
  };

  // Downloads 업로드 완료 시 신규 와인 수 업데이트
  const handleUploadComplete = (type: string, result: Record<string, unknown>) => {
    if (type === 'downloads' && typeof result.newWinesDetected === 'number') {
      setNewWineCount(result.newWinesDetected);
    }
  };

  if (authChecking) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
      }}>
        <div style={{ fontSize: 14, color: '#a8a098' }}>인증 확인 중...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 56px)',
        background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
          border: '1px solid rgba(90,21,21,0.06)',
          padding: '40px 32px',
          width: 320,
          textAlign: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a8a098" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2c1810', marginBottom: 4 }}>
            관리자 인증
          </div>
          <div style={{ fontSize: 13, color: '#a8a098', marginBottom: 24 }}>
            비밀번호를 입력하세요
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            placeholder="••••"
            autoFocus
            style={{
              width: '100%',
              height: 44,
              fontSize: 24,
              textAlign: 'center',
              letterSpacing: '0.3em',
              border: `1.5px solid ${error ? '#e74c3c' : 'rgba(90,21,21,0.08)'}`,
              borderRadius: 6,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8 }}>
              비밀번호가 틀렸습니다
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={pin.length < 4 || loginLoading}
            style={{
              width: '100%',
              height: 40,
              marginTop: 16,
              background: pin.length >= 4 && !loginLoading ? '#5A1515' : '#ddd',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: pin.length >= 4 && !loginLoading ? 'pointer' : 'default',
              transition: 'background 0.2s',
            }}
          >
            {loginLoading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 1250, margin: '0 auto', padding: '0 16px 24px' }}>
        {/* Header */}
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#2c1810',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: '-0.01em',
          }}>Admin</h1>
        </div>

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
        {activeTab === 'price-list' && <PriceListTab />}
        {activeTab === 'change-log' && <ChangeLogTab />}
        {activeTab === 'client-analysis' && <ClientAnalysisTab />}
        {activeTab === 'recommend-settings' && <RecommendSettingsTab />}
        {activeTab === 'wine-regions' && <WineRegionsTab />}
        {activeTab === 'brand-library' && <BrandTab />}
        {activeTab === 'company-events' && <CompanyEventsTab />}
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
