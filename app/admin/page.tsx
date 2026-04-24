'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { TabId } from '@/app/types/wine';
import AdminTabs from './components/AdminTabs';
import UploadTab from './components/UploadTab';
import '@/app/styles/design-system.css';

const tabLoader = () => (
  <div style={{ padding: 40, textAlign: 'center', color: '#a8a098', fontSize: 14 }}>로딩 중...</div>
);

const DashboardTab = dynamic(() => import('./components/DashboardTab'), { ssr: false, loading: tabLoader });
const NewWineTab = dynamic(() => import('./components/NewWineTab'), { ssr: false, loading: tabLoader });
const AllWinesTab = dynamic(() => import('./components/AllWinesTab'), { ssr: false, loading: tabLoader });
const TastingNoteTab = dynamic(() => import('./components/TastingNoteTab'), { ssr: false, loading: tabLoader });
const PriceListTab = dynamic(() => import('./components/PriceListTab'), { ssr: false, loading: tabLoader });
const ChangeLogTab = dynamic(() => import('./components/ChangeLogTab'), { ssr: false, loading: tabLoader });
const ClientAnalysisTab = dynamic(() => import('./components/ClientAnalysisTab'), { ssr: false, loading: tabLoader });
const RecommendSettingsTab = dynamic(() => import('./components/RecommendSettingsTab'), { ssr: false, loading: tabLoader });
const WineRegionsTab = dynamic(() => import('./components/WineRegionsTab'), { ssr: false, loading: tabLoader });
const BrandTab = dynamic(() => import('./components/BrandTab'), { ssr: false, loading: tabLoader });
const CompanyEventsTab = dynamic(() => import('./components/CompanyEventsTab'), { ssr: false, loading: tabLoader });
const ImportForecastTab = dynamic(() => import('./components/ImportForecastTab'), { ssr: false, loading: tabLoader });

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
            {mfaRequired
              ? (useBackupCode ? '백업 코드를 입력하세요' : '인증 앱 6자리 코드')
              : '비밀번호를 입력하세요'}
          </div>
          {!mfaRequired && (
            <input
              type="password"
              value={pin}
              onChange={e => { setPin(e.target.value); setError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
              placeholder=""
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
          )}
          {mfaRequired && (
            <input
              type="text"
              inputMode={useBackupCode ? 'text' : 'numeric'}
              value={mfaCode}
              onChange={e => { setMfaCode(e.target.value); setMfaError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
              placeholder={useBackupCode ? '8자리 영숫자' : '000000'}
              maxLength={useBackupCode ? 8 : 6}
              autoFocus
              style={{
                width: '100%',
                height: 44,
                fontSize: 22,
                textAlign: 'center',
                letterSpacing: useBackupCode ? '0.2em' : '0.4em',
                border: `1.5px solid ${mfaError ? '#e74c3c' : 'rgba(90,21,21,0.08)'}`,
                borderRadius: 6,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                fontFamily: 'monospace',
              }}
            />
          )}
          {error && !mfaRequired && (
            <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8 }}>
              비밀번호가 틀렸습니다
            </div>
          )}
          {mfaError && (
            <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 8 }}>{mfaError}</div>
          )}
          <button
            onClick={handleLogin}
            disabled={(mfaRequired ? mfaCode.length < (useBackupCode ? 8 : 6) : pin.length < 1) || loginLoading}
            style={{
              width: '100%',
              height: 40,
              marginTop: 16,
              background: ((mfaRequired ? mfaCode.length >= (useBackupCode ? 8 : 6) : pin.length >= 1) && !loginLoading) ? '#5A1515' : '#ddd',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: ((mfaRequired ? mfaCode.length >= (useBackupCode ? 8 : 6) : pin.length >= 1) && !loginLoading) ? 'pointer' : 'default',
              transition: 'background 0.2s',
            }}
          >
            {loginLoading ? '확인 중...' : (mfaRequired ? '인증' : '확인')}
          </button>
          {mfaRequired && (
            <div style={{ marginTop: 12, fontSize: 12 }}>
              <button
                onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(''); setMfaError(''); }}
                style={{ background: 'none', border: 'none', color: '#5A1515', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                {useBackupCode ? '인증 앱 코드로 변경' : '백업 코드 사용'}
              </button>
              <button
                onClick={() => { setMfaRequired(false); setMfaCode(''); setMfaError(''); setPin(''); }}
                style={{ background: 'none', border: 'none', color: '#a8a098', cursor: 'pointer', marginLeft: 12, padding: 0 }}
              >
                비밀번호부터 다시
              </button>
            </div>
          )}
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
        <div style={{
          marginTop: 16, marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#2c1810',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: '-0.01em',
          }}>Admin</h1>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <a href="/admin/password" style={{ color: '#5A1515', textDecoration: 'none' }}>
              🔑 비밀번호 변경
            </a>
            <a href="/admin/mfa-setup" style={{ color: '#5A1515', textDecoration: 'none' }}>
              🔐 MFA 설정
            </a>
          </div>
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
        {activeTab === 'import-forecast' && <ImportForecastTab />}
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
