'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const tabLoader = () => (
  <div style={{ padding: 40, textAlign: 'center', color: '#a8a098', fontSize: 14 }}>로딩 중...</div>
);

const ImportForecastTab = dynamic(() => import('@/app/admin/components/ImportForecastTab'), { ssr: false, loading: tabLoader });
const SalesAnalysisTab = dynamic(() => import('@/app/marketing/components/SalesAnalysisTab'), { ssr: false, loading: tabLoader });

export default function MarketingPage() {
  const [currentManager, setCurrentManager] = useState('');
  const [activeTab, setActiveTab] = useState<'forecast' | 'analysis'>('forecast');
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

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, paddingTop: 8 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111', margin: 0, fontFamily: "'Cormorant Garamond', serif", letterSpacing: '-0.02em' }}>Marketing</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {currentManager && (
              <span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>{currentManager}</span>
            )}
            <button
              onClick={() => setShowPwChange(!showPwChange)}
              style={{
                padding: '5px 10px', borderRadius: 6, border: '1px solid #e0e0e0',
                background: showPwChange ? '#111' : '#fff', color: showPwChange ? '#fff' : '#999',
                fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              비밀번호 변경
            </button>
          </div>
        </div>

        {/* Password Change */}
        {showPwChange && (
          <div style={{
            background: '#fafafa', borderRadius: 8,
            border: '1px solid #eee',
            padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                placeholder="현재 비밀번호"
                style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', background: '#fff' }} />
              <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                placeholder="새 비밀번호"
                style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', background: '#fff' }} />
              <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', background: '#fff' }}
                onKeyDown={e => { if (e.key === 'Enter') handlePwChange(); }} />
              <button onClick={handlePwChange} disabled={pwLoading}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: pwLoading ? '#ccc' : '#111', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: pwLoading ? 'default' : 'pointer',
                }}>
                {pwLoading ? '변경 중...' : '변경'}
              </button>
            </div>
            {pwError && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{pwError}</div>}
            {pwSuccess && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8 }}>{pwSuccess}</div>}
          </div>
        )}

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 2, marginBottom: 20, width: 'fit-content' }}>
          {([['forecast', '수입량 예측'], ['analysis', '판매 분석']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: activeTab === t ? 700 : 500,
              background: activeTab === t ? '#fff' : 'transparent', color: activeTab === t ? '#111' : '#888',
              cursor: 'pointer', boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {activeTab === 'forecast' && <ImportForecastTab />}
        {activeTab === 'analysis' && <SalesAnalysisTab />}
      </div>
    </div>
  );
}
