'use client';

import { useState, useEffect } from 'react';
import type { TabId } from '@/app/types/wine';
import AdminTabs from './components/AdminTabs';
import UploadTab from './components/UploadTab';
import DashboardTab from './components/DashboardTab';
import AllWinesTab from './components/AllWinesTab';
import TastingNoteTab from './components/TastingNoteTab';
import PriceListTab from './components/PriceListTab';
import ChangeLogTab from './components/ChangeLogTab';
import ClientAnalysisTab from './components/ClientAnalysisTab';
import '@/app/styles/design-system.css';

const ADMIN_PIN = '0000';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('admin_auth') === 'true') {
        setAuthenticated(true);
      }
    } catch {}
  }, []);

  const handleLogin = () => {
    if (pin === ADMIN_PIN) {
      setAuthenticated(true);
      setError(false);
      try { sessionStorage.setItem('admin_auth', 'true'); } catch {}
    } else {
      setError(true);
      setPin('');
    }
  };

  const handleUploadComplete = (_type: string, _result: Record<string, unknown>) => {};

  if (!authenticated) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 56px)',
        background: '#fafaf8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '40px 32px',
          width: 320,
          textAlign: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', marginBottom: 4 }}>
            관리자 인증
          </div>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
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
              border: `1px solid ${error ? '#e74c3c' : '#E5E5E5'}`,
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
            disabled={pin.length < 4}
            style={{
              width: '100%',
              height: 40,
              marginTop: 16,
              background: pin.length >= 4 ? '#5A1515' : '#ddd',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: pin.length >= 4 ? 'pointer' : 'default',
              transition: 'background 0.2s',
            }}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: '#fafaf8',
    }}>
      <div className="ds-page">
        {/* Header */}
        <div className="ds-page-header">
          <h1 className="ds-page-title">관리자</h1>
        </div>

        {/* 탭 바 */}
        <AdminTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* 탭 콘텐츠 */}
        {activeTab === 'upload' && <UploadTab onUploadComplete={handleUploadComplete} />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'all-wines' && <AllWinesTab />}
        {activeTab === 'tasting-note' && <TastingNoteTab />}
        {activeTab === 'price-list' && <PriceListTab />}
        {activeTab === 'change-log' && <ChangeLogTab />}
        {activeTab === 'client-analysis' && <ClientAnalysisTab />}
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
