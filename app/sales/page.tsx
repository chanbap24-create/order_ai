'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import SalesTabs from './components/SalesTabs';
import type { SalesTabId } from './components/SalesTabs';

// 첫 화면(미팅)만 즉시 로드, 나머지는 lazy
import MeetingTab from './components/MeetingTab';
const BriefingTab = dynamic(() => import('./components/BriefingTab'), { ssr: false });
const ShipmentTab = dynamic(() => import('./components/ShipmentTab'), { ssr: false });
const AlertTab = dynamic(() => import('./components/AlertTab'), { ssr: false });
const AnalysisTab = dynamic(() => import('./components/AnalysisTab'), { ssr: false });
const LedgerTab = dynamic(() => import('./components/LedgerTab'), { ssr: false });
const ItemLedgerTab = dynamic(() => import('./components/ItemLedgerTab'), { ssr: false });
const OutstandingTab = dynamic(() => import('./components/OutstandingTab'), { ssr: false });
const ClientListTab = dynamic(() => import('./components/ClientListTab'), { ssr: false });
const ExpenseTab = dynamic(() => import('./components/ExpenseTab'), { ssr: false });

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
  const [userRole, setUserRole] = useState('');
  const [userDepartment, setUserDepartment] = useState('');

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

  // ── 세션 확인 + 담당자 목록 병렬 로드 ──
  useEffect(() => {
    const authP = fetch('/api/auth/me').then(r => r.json()).catch(() => null);
    const mgrP = fetch('/api/sales/clients/managers').then(r => r.json()).catch(() => null);
    Promise.all([authP, mgrP]).then(([authData, mgrData]) => {
      if (authData?.authenticated) {
        setAuthenticated(true);
        setCurrentManager(authData.manager);
        setIsAdmin(authData.role === 'admin' || authData.role === 'executive' || authData.department === '마케팅부');
        setUserRole(authData.role || '');
        setUserDepartment(authData.department || '');
        if (authData.role === 'executive') setActiveTab('analysis');
      }
      if (mgrData?.managers) setManagerList(mgrData.managers);
      setAuthChecking(false);
    });
  }, []);

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
        setIsAdmin(data.role === 'admin' || data.role === 'executive');
        setUserRole(data.role || '');
        setUserDepartment(data.department || '');
        if (data.role === 'executive') setActiveTab('analysis');
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
    setActiveTab('meetings');
    setAlertCount(0);
    setActionCount(0);
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
        background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#8a8580', fontSize: 14 }}>확인 중...</div>
      </div>
    );
  }

  // ── 로그인 화면 ──
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
          width: '100%',
          maxWidth: 360,
          padding: '40px 24px',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(90,21,21,0.06), 0 1px 4px rgba(90,21,21,0.03)',
          border: '1px solid rgba(90,21,21,0.06)',
          margin: '0 16px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#2c1810',
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              letterSpacing: '0.05em',
            }}>
              Sales Support
            </h1>
            <p style={{ fontSize: 13, color: '#8a8580', margin: '8px 0 0' }}>
              영업 지원 시스템 로그인
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
              담당자
            </label>
            <select
              value={loginManager}
              onChange={e => setLoginManager(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.08)',
                fontSize: 16,
                background: '#faf9f7',
                color: loginManager ? '#2c1810' : '#a8a098',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <option value="">담당자 선택</option>
              {managerList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
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
                borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.08)',
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
                background: '#faf9f7',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {loginError && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.04)',
              border: '1.5px solid rgba(220,38,38,0.15)',
              borderRadius: 10,
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
              padding: '13px 0',
              borderRadius: 10,
              border: 'none',
              background: loginLoading ? '#c4a0a0' : '#5A1515',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: loginLoading ? 'default' : 'pointer',
              transition: 'background 0.2s ease',
              letterSpacing: '0.02em',
            }}
          >
            {loginLoading ? '로그인 중...' : '로그인'}
          </button>

          <p style={{ fontSize: 11, color: '#a8a098', textAlign: 'center', marginTop: 16 }}>
            담당자 이름과 비밀번호를 입력하세요
          </p>
        </div>
      </div>
    );
  }

  // ── 인증된 메인 화면 ──
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
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
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#2c1810',
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              letterSpacing: '0.02em',
            }}>
              Sales Support
            </h1>
            <p style={{ fontSize: 13, color: '#8a8580', margin: '4px 0 0' }}>
              {currentManager}{isAdmin ? ' (관리자)' : ''} · 영업 지원 시스템
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { setShowPwChange(!showPwChange); setPwError(''); setPwSuccess(''); }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: showPwChange ? '1.5px solid rgba(90,21,21,0.2)' : '1.5px solid rgba(90,21,21,0.08)',
                background: showPwChange ? 'rgba(90,21,21,0.04)' : 'transparent',
                fontSize: 11,
                fontWeight: 600,
                color: showPwChange ? '#5A1515' : '#8a8580',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap' as const,
              }}
            >
              PW
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid rgba(90,21,21,0.08)',
                background: 'transparent',
                fontSize: 11,
                fontWeight: 600,
                color: '#8a8580',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap' as const,
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 비밀번호 변경 패널 */}
        {showPwChange && (
          <div style={{
            background: '#fff',
            borderRadius: 14,
            border: '1px solid rgba(90,21,21,0.06)',
            boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
            padding: '18px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>
              비밀번호 변경
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="password"
                value={pwCurrent}
                onChange={e => setPwCurrent(e.target.value)}
                placeholder="현재 비밀번호"
                style={{
                  flex: '1 1 120px',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid rgba(90,21,21,0.08)',
                  fontSize: 16,
                  outline: 'none',
                  background: '#faf9f7',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <input
                type="password"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                placeholder="새 비밀번호"
                style={{
                  flex: '1 1 120px',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid rgba(90,21,21,0.08)',
                  fontSize: 16,
                  outline: 'none',
                  background: '#faf9f7',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <input
                type="password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                onKeyDown={e => { if (e.key === 'Enter') handlePwChange(); }}
                style={{
                  flex: '1 1 120px',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid rgba(90,21,21,0.08)',
                  fontSize: 16,
                  outline: 'none',
                  background: '#faf9f7',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button
                onClick={handlePwChange}
                disabled={pwLoading}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: pwLoading ? '#c4a0a0' : '#5A1515',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: pwLoading ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s ease',
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
        <SalesTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} userRole={userRole} />

        {/* 탭 콘텐츠 */}
        {activeTab === 'meetings' && <MeetingTab currentManager={currentManager} isAdmin={userRole === 'executive' ? false : isAdmin} />}
        {activeTab === 'briefing' && <BriefingTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'shipments' && <ShipmentTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'analysis' && <AnalysisTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'ledger' && <LedgerTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'item-ledger' && <ItemLedgerTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'outstanding' && <OutstandingTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'client-list' && <ClientListTab currentManager={currentManager} isAdmin={isAdmin} />}
        {activeTab === 'alerts' && <AlertTab currentManager={currentManager} isAdmin={isAdmin} onCountChange={handleAlertCountChange} />}
        {activeTab === 'expense' && <ExpenseTab currentManager={currentManager} isAdmin={isAdmin} department={userDepartment} />}
      </div>
    </div>
  );
}
