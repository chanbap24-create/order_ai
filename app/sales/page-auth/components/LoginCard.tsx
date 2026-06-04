'use client';

import { useState } from 'react';

type Props = {
  managerList: string[];
  onSuccess: (data: { manager: string; role?: string; department?: string }) => void;
};

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLSelectElement | HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)';
  },
  onBlur: (e: React.FocusEvent<HTMLSelectElement | HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)';
    e.currentTarget.style.boxShadow = 'none';
  },
};

export function LoginCard({ managerList, onSuccess }: Props) {
  const [loginManager, setLoginManager] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

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
        onSuccess(data);
      } else {
        setLoginError(data.error || '로그인 실패');
      }
    } catch {
      setLoginError('서버 오류가 발생했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'linear-gradient(180deg, var(--surface-muted) 0%, #f5f3f0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 360, padding: '40px 24px',
        background: 'white', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(90,21,21,0.06), 0 1px 4px rgba(90,21,21,0.03)',
        border: '1px solid rgba(90,21,21,0.06)', margin: '0 16px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
            fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.05em',
          }}>
            Sales Support
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
            영업 지원 시스템 로그인
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>담당자</label>
          <select
            value={loginManager}
            onChange={e => setLoginManager(e.target.value)}
            style={{ ...inputStyle, color: loginManager ? 'var(--text-primary)' : 'var(--text-muted)' }}
            {...focusHandlers}
          >
            <option value="">담당자 선택</option>
            {managerList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>비밀번호</label>
          <input
            type="password"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            placeholder="비밀번호 입력"
            style={inputStyle}
            {...focusHandlers}
          />
        </div>

        {loginError && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(220,38,38,0.04)',
            border: '1.5px solid rgba(220,38,38,0.15)',
            borderRadius: 10, fontSize: 13, color: 'var(--status-danger)', marginBottom: 16,
          }}>
            {loginError}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
            background: loginLoading ? '#c4a0a0' : 'var(--action)',
            color: 'white', fontSize: 15, fontWeight: 600,
            cursor: loginLoading ? 'default' : 'pointer',
            transition: 'background 0.2s ease', letterSpacing: '0.02em',
          }}
        >
          {loginLoading ? '로그인 중...' : '로그인'}
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>
          담당자 이름과 비밀번호를 입력하세요
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
  display: 'block', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1.5px solid rgba(90,21,21,0.08)',
  fontSize: 16, background: 'var(--surface-muted)', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};
