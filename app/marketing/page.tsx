'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LoadGateProvider } from '@/app/components/ui/LoadGate';

const tabLoader = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>로딩 중...</div>
);

const ImportForecastTab = dynamic(() => import('@/app/admin/components/ImportForecastTab'), { ssr: false, loading: tabLoader });
const SalesAnalysisTab = dynamic(() => import('@/app/marketing/components/SalesAnalysisTab'), { ssr: false, loading: tabLoader });
const FlavorTagsTab = dynamic(() => import('@/app/admin/components/FlavorTagsTab'), { ssr: false, loading: tabLoader });
const WineRegionsTab = dynamic(() => import('@/app/admin/components/WineRegionsTab'), { ssr: false, loading: tabLoader });
const BrandTab = dynamic(() => import('@/app/admin/components/BrandTab'), { ssr: false, loading: tabLoader });

export default function MarketingPage() {
  // 부팅 커튼 — 페이지가 조각조각 뜨지 않고 한 번에 공개
  return (
    <LoadGateProvider>
      <MarketingPageBody />
    </LoadGateProvider>
  );
}

function MarketingPageBody() {
  const [currentManager, setCurrentManager] = useState('');
  const [activeTab, setActiveTab] = useState<'forecast' | 'analysis' | 'flavor' | 'regions' | 'brands'>('forecast');
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
    <div
      className="marketing-container"
      style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--surface-muted)' }}
    >
      <style>{`
        @media (max-width: 768px) {
          .marketing-container .marketing-inner { padding: 16px 12px !important; }
        }
      `}</style>
      <div
        className="marketing-inner"
        style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingBottom: 16,
            marginBottom: 20,
            borderBottom: '1px solid var(--border-subtle)',
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{

                fontSize: '1.5rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
                letterSpacing: '0.01em',
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              Marketing
            </h1>
            <div
              style={{
                width: 32,
                height: 2,
                marginTop: 10,
                background: 'var(--action)',
                borderRadius: 1,
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setShowPwChange(!showPwChange)}
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 6,
                border: `1px solid ${showPwChange ? 'var(--border-strong)' : 'var(--border-default)'}`,
                background: showPwChange ? 'var(--surface-hover)' : 'var(--surface)',
                color: showPwChange ? 'var(--action)' : 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              비밀번호
            </button>
          </div>
        </header>

        {/* Password Change */}
        {showPwChange && (
          <div style={{
            background: 'var(--gray-50)', borderRadius: 8,
            border: '1px solid var(--border-default)',
            padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                placeholder="현재 비밀번호"
                style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 13, outline: 'none', background: '#fff' }} />
              <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                placeholder="새 비밀번호"
                style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 13, outline: 'none', background: '#fff' }} />
              <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 13, outline: 'none', background: '#fff' }}
                onKeyDown={e => { if (e.key === 'Enter') handlePwChange(); }} />
              <button onClick={handlePwChange} disabled={pwLoading}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: pwLoading ? 'var(--gray-300)' : 'var(--neutral-900)', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: pwLoading ? 'default' : 'pointer',
                }}>
                {pwLoading ? '변경 중...' : '변경'}
              </button>
            </div>
            {pwError && <div style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 8 }}>{pwError}</div>}
            {pwSuccess && <div style={{ fontSize: 12, color: 'var(--status-success)', marginTop: 8 }}>{pwSuccess}</div>}
          </div>
        )}

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 2, marginBottom: 20, width: 'fit-content' }}>
          {([['forecast', '수입량 예측'], ['analysis', '판매 분석'], ['flavor', '향미 태그'], ['regions', '와인산지 DB'], ['brands', '브랜드자료실']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: activeTab === t ? 700 : 500,
              background: activeTab === t ? '#fff' : 'transparent', color: activeTab === t ? 'var(--neutral-900)' : 'var(--neutral-200)',
              cursor: 'pointer', boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {activeTab === 'forecast' && <ImportForecastTab />}
        {activeTab === 'analysis' && <SalesAnalysisTab />}
        {activeTab === 'flavor' && <FlavorTagsTab />}
        {activeTab === 'regions' && <WineRegionsTab />}
        {activeTab === 'brands' && <BrandTab />}
      </div>
    </div>
  );
}
