'use client';

import { useEffect, useState } from 'react';

export default function MfaSetupPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // 진입 시 secret + QR 요청 (admin_auth 쿠키로 인증됨)
  useEffect(() => {
    fetch('/api/auth/admin-mfa/setup')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || '설정 초기화 실패');
          return;
        }
        setSecret(d.secret);
        setQrDataUrl(d.qr_data_url);
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false));
  }, []);

  const verify = async () => {
    if (code.length < 6) return;
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/admin-mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || '검증 실패');
        setCode('');
        return;
      }
      setBackupCodes(d.backup_codes || []);
    } catch {
      setError('네트워크 오류');
    } finally {
      setVerifying(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!backupCodes) return;
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    alert('백업 코드가 복사되었습니다. 안전한 곳에 붙여 넣고 저장하세요.');
  };

  // 설정 완료 후 백업 코드 표시 화면
  if (backupCodes) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>🎉 MFA 설정 완료</h1>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>
            아래 <strong>백업 코드 10개</strong>를 안전한 곳에 저장하세요.
            인증 앱을 분실했을 때 각 1회 사용 가능합니다.
          </p>
          <div style={{
            background: 'var(--surface-muted)', border: '1px solid rgba(90,21,21,0.1)',
            borderRadius: 6, padding: 16, fontFamily: 'monospace',
            fontSize: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          }}>
            {backupCodes.map((c) => (<span key={c}>{c}</span>))}
          </div>
          <button onClick={copyBackupCodes} style={btnPrimary}>모두 복사</button>
          <button
            onClick={() => { window.location.href = '/admin'; }}
            style={{ ...btnPrimary, background: '#fff', color: 'var(--action)', border: '1px solid var(--action)', marginTop: 8 }}
          >
            관리자 페이지로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>2단계 인증 설정</h1>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>QR 코드 생성 중...</div>}
        {error && <div style={{ color: 'var(--status-danger)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
        {!loading && qrDataUrl && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              1. 인증 앱(Google Authenticator, Authy 등)으로 아래 QR 코드를 스캔하세요.
            </p>
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <img src={qrDataUrl} alt="TOTP QR" style={{ width: 200, height: 200 }} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              2. 앱에 표시된 <strong>6자리 코드</strong>를 입력하세요.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
              placeholder="000000"
              autoFocus
              style={{
                width: '100%', height: 48, fontSize: 24, textAlign: 'center',
                letterSpacing: '0.4em', fontFamily: 'monospace',
                border: '1.5px solid rgba(90,21,21,0.2)', borderRadius: 6,
                outline: 'none', marginTop: 8, boxSizing: 'border-box',
              }}
            />
            <button
              onClick={verify}
              disabled={code.length < 6 || verifying}
              style={{
                ...btnPrimary,
                background: code.length >= 6 && !verifying ? 'var(--action)' : 'var(--gray-300)',
                cursor: code.length >= 6 && !verifying ? 'pointer' : 'default',
              }}
            >
              {verifying ? '검증 중...' : '완료'}
            </button>
            <details style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <summary style={{ cursor: 'pointer' }}>수동 입력용 시크릿</summary>
              <code style={{ display: 'block', marginTop: 8, padding: 8, background: 'var(--surface-muted)', borderRadius: 4, wordBreak: 'break-all' }}>
                {secret}
              </code>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 56px)',
  background: 'linear-gradient(180deg, var(--surface-muted) 0%, #f5f3f0 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, fontFamily: "'DM Sans', -apple-system, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  boxShadow: '0 2px 8px rgba(90,21,21,0.05)',
  border: '1px solid var(--action-muted)',
  padding: '32px 28px', width: '100%', maxWidth: 420,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
  marginTop: 0, marginBottom: 16, fontFamily: "'Cormorant Garamond', serif",
};

const btnPrimary: React.CSSProperties = {
  width: '100%', height: 42, marginTop: 16,
  background: 'var(--action)', color: '#fff', border: 'none',
  borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
