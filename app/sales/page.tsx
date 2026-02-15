'use client';

import { useState, useCallback, useEffect } from 'react';
import SalesTabs from './components/SalesTabs';
import type { SalesTabId } from './components/SalesTabs';
import ClientTab from './components/ClientTab';
import RecommendTab from './components/RecommendTab';
import MeetingTab from './components/MeetingTab';
import BriefingTab from './components/BriefingTab';
import AlertTab from './components/AlertTab';
import AnalysisTab from './components/AnalysisTab';

export default function SalesPage() {
  // ── 인증 상태 ──
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentManager, setCurrentManager] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // ── 로그인 폼 ──
  const [loginManager, setLoginManager] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [managerList, setManagerList] = useState<string[]>([]);

  // ── 비밀번호 변경 ──
  const [showPwChange, setShowPwChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // ── 탭 ──
  const [activeTab, setActiveTab] = useState<SalesTabId>('meetings');
  const [alertCount, setAlertCount] = useState<number>(0);

  const handleAlertCountChange = useCallback((count: number) => {
    setAlertCount(count);
  }, []);

  // ── 세션 확인 ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
          setCurrentManager(data.manager);
          setIsAdmin(data.role === 'admin');
        }
      } catch { /* not authenticated */ }
      finally { setAuthChecking(false); }
    })();
  }, []);

  // ── 담당자 목록 (로그인 폼용) ──
  useEffect(() => {
    if (authenticated) return;
    (async () => {
      try {
        const res = await fetch('/api/sales/clients/managers');
        const data = await res.json();
        if (data.managers) setManagerList(data.managers);
      } catch { /* ignore */ }
    })();
  }, [authenticated]);

  // ── 로그인 ──
  const handleLogin = async () => {
    if (!loginManager) { setLoginError('담당자를 선택해주세요.'); return; }
    if (!loginPassword) { setLoginError('비밀번호를 입력해주세요.'); return; }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager: loginManager, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        setCurrentManager(data.manager);
        setIsAdmin(data.role === 'admin');
      } else {
        setLoginError(data.error || '로그인 실패');
      }
    } catch {
      setLoginError('서버 오류가 발생했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── 로그아웃 ──
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch { /* ignore */ }
    setAuthenticated(false);
    setCurrentManager('');
    setIsAdmin(false);
    setLoginManager('');
    setLoginPassword('');
    setActiveTab('clients');
    setAlertCount(0);
  };

  // ── 비밀번호 변경 ──
  const handlePwChange = async () => {
    if (!pwNew) { setPwError('새 비밀번호를 입력해주세요.'); return; }
    if (pwNew.length < 4) { setPwError('비밀번호는 4자 이상이어야 합니다.'); return; }
    if (pwNew !== pwConfirm) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
    setPwLoading(true);
    setPwError('');
    setPwSuccess('');
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json();
      if (data.success) {
        setPwSuccess('비밀번호가 변경되었습니다.');
        setPwCurrent(''); setPwNew(''); setPwConfirm('');
        setTimeout(() => { setShowPwChange(false); setPwSuccess(''); }, 1500);
      } else {
        setPwError(data.error || '변경 실패');
      }
    } catch {
      setPwError('서버 오류가 발생했습니다.');
    } finally {
      setPwLoading(false);
    }
  };

  // ── 로딩 중 ──
  if (authChecking) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 56px)',
        background: '#fafaf8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#999', fontSize: 14 }}>확인 중...</div>
      </div>
    );
  }

  // ── 로그인 화면 ──
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
          width: '100%',
          maxWidth: 360,
          padding: '40px 24px',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          margin: '0 16px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#1a1a2e',
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              letterSpacing: '0.05em',
            }}>
              Sales Support
            </h1>
            <p style={{ fontSize: 13, color: '#999', margin: '8px 0 0' }}>
              영업 지원 시스템 로그인
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>
              담당자
            </label>
            <select
              value={loginManager}
              onChange={e => setLoginManager(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #e0dcd4',
                fontSize: 16,
                background: '#fff',
                color: loginManager ? '#1a1a2e' : '#999',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">담당자 선택</option>
              <option value="ADMIN">ADMIN (관리자)</option>
              {managerList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>
              비밀번호
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
              placeholder="비밀번호 입력"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #e0dcd4',
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {loginError && (
            <div style={{
              padding: '10px 14px',
              background: '#fff5f5',
              border: '1px solid #fecaca',
              borderRadius: 8,
              fontSize: 13,
              color: '#dc2626',
              marginBottom: 16,
            }}>
              {loginError}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loginLoading}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 8,
              border: 'none',
              background: loginLoading ? '#ccc' : '#5A1515',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: loginLoading ? 'default' : 'pointer',
            }}
          >
            {loginLoading ? '로그인 중...' : '로그인'}
          </button>

          <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 16 }}>
            초기 비밀번호: 0000
          </p>
        </div>
      </div>
    );
  }

  // ── 인증된 메인 화면 ──
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: '#fafaf8',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#1a1a2e',
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              letterSpacing: '0.05em',
            }}>
              Sales Support
            </h1>
            <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
              {currentManager}{isAdmin ? ' (관리자)' : ''} · 영업 지원 시스템
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => { setShowPwChange(!showPwChange); setPwError(''); setPwSuccess(''); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e0dcd4',
                background: showPwChange ? '#f5f5f0' : 'white',
                fontSize: 12,
                color: '#666',
                cursor: 'pointer',
              }}
            >
              비밀번호
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e0dcd4',
                background: 'white',
                fontSize: 12,
                color: '#999',
                cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 비밀번호 변경 패널 */}
        {showPwChange && (
          <div style={{
            background: 'white',
            borderRadius: 12,
            border: '1px solid #e8e6e1',
            padding: '20px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 16 }}>
              비밀번호 변경
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="password"
                value={pwCurrent}
                onChange={e => setPwCurrent(e.target.value)}
                placeholder="현재 비밀번호"
                style={{
                  flex: '1 1 120px',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #e0dcd4',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              <input
                type="password"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                placeholder="새 비밀번호"
                style={{
                  flex: '1 1 120px',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #e0dcd4',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              <input
                type="password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                onKeyDown={e => { if (e.key === 'Enter') handlePwChange(); }}
                style={{
                  flex: '1 1 120px',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #e0dcd4',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              <button
                onClick={handlePwChange}
                disabled={pwLoading}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: pwLoading ? '#ccc' : '#5A1515',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: pwLoading ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {pwLoading ? '변경 중...' : '변경'}
              </button>
            </div>
            {pwError && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{pwError}</div>
            )}
            {pwSuccess && (
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8 }}>{pwSuccess}</div>
            )}
          </div>
        )}

        {/* 탭 */}
        <SalesTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} />

        {/* 탭 콘텐츠 */}
        {activeTab === 'clients' && <ClientTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'recommend' && <RecommendTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'meetings' && <MeetingTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'briefing' && <BriefingTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'analysis' && <AnalysisTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'alerts' && <AlertTab currentManager={currentManager} isAdmin={isAdmin} onCountChange={handleAlertCountChange} />}
      </div>
    </div>
  );
}
