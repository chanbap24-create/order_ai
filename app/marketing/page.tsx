'use client';

import { useState, useEffect } from 'react';
import ImportForecastTab from '@/app/admin/components/ImportForecastTab';

const inputStyle: React.CSSProperties = {
  flex: '1 1 120px',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid rgba(90,21,21,0.08)',
  fontSize: 16,
  outline: 'none',
  background: '#faf9f7',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

export default function MarketingPage() {
  const [currentManager, setCurrentManager] = useState('');
  const [showPwChange, setShowPwChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d?.manager) setCurrentManager(d.manager);
    }).catch(() => {});
  }, []);

  const handlePwChange = async () => {
    if (!pwNew) { setPwError('새 비밀번호를 입력해주세요.'); return; }
    if (pwNew.length < 4) { setPwError('비밀번호는 4자 이상이어야 합니다.'); return; }
    if (pwNew !== pwConfirm) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
    setPwLoading(true); setPwError(''); setPwSuccess('');
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

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(90,21,21,0.25)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,21,21,0.06)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(90,21,21,0.08)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#f5f3f0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', margin: 0, fontFamily: "'Cormorant Garamond', serif", letterSpacing: '-0.01em' }}>Marketing</h1>
            <span style={{ fontSize: 12, color: '#a8a098', padding: '2px 8px', background: '#fff', borderRadius: 6, border: '1px solid #e8e4e0' }}>수입량 예측 분석</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentManager && (
              <span style={{ fontSize: 13, color: '#5A1515', fontWeight: 600 }}>{currentManager}</span>
            )}
            <button
              onClick={() => setShowPwChange(!showPwChange)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #e8e4e0',
                background: showPwChange ? '#5A1515' : '#fff', color: showPwChange ? '#fff' : '#8a8580',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              비밀번호 변경
            </button>
          </div>
        </div>

        {showPwChange && (
          <div style={{
            background: '#fff', borderRadius: 14,
            border: '1px solid rgba(90,21,21,0.06)',
            boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
            padding: 18, marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>
              비밀번호 변경
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                placeholder="현재 비밀번호" style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
              <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                placeholder="새 비밀번호" style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
              <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                placeholder="새 비밀번호 확인" style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}
                onKeyDown={e => { if (e.key === 'Enter') handlePwChange(); }} />
              <button onClick={handlePwChange} disabled={pwLoading}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: pwLoading ? '#c4a0a0' : '#5A1515', color: 'white',
                  fontSize: 13, fontWeight: 600, cursor: pwLoading ? 'default' : 'pointer',
                  whiteSpace: 'nowrap', transition: 'background 0.2s ease',
                }}>
                {pwLoading ? '변경 중...' : '변경'}
              </button>
            </div>
            {pwError && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{pwError}</div>}
            {pwSuccess && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8 }}>{pwSuccess}</div>}
          </div>
        )}

        <ImportForecastTab />
      </div>
    </div>
  );
}
