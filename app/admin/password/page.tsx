'use client';

import { useEffect, useState } from 'react';

export default function AdminPasswordPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/admin-password')
      .then(async (r) => {
        if (!r.ok) { window.location.href = '/admin'; return; }
        const d = await r.json();
        setNeedsMfa(!!d.mfa_enabled);
        setMigrationNeeded(!!d.migration_needed);
        setAuthChecked(true);
      })
      .catch(() => { window.location.href = '/admin'; });
  }, []);

  const submit = async () => {
    setError('');
    if (newPw.length < 8) { setError('새 비밀번호는 8자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setError('새 비밀번호 확인이 일치하지 않습니다.'); return; }
    if (currentPw === newPw) { setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.'); return; }
    if (needsMfa && mfaCode.length < (useBackupCode ? 8 : 6)) {
      setError(useBackupCode ? '백업 코드 8자리를 입력하세요.' : 'TOTP 6자리를 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {
        current_password: currentPw,
        new_password: newPw,
      };
      if (needsMfa) {
        if (useBackupCode) body.backup_code = mfaCode;
        else body.totp = mfaCode;
      }
      const res = await fetch('/api/auth/admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || '변경 실패');
        // MFA 필요한데 보내지 않음 → needsMfa 유지 (서버가 400 반환)
        return;
      }
      setSuccess(true);
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return <div style={pageStyle}><div style={{ color: 'var(--text-muted)' }}>확인 중...</div></div>;
  }

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>✅ 비밀번호 변경 완료</h1>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>
            새 비밀번호로 안전하게 보관하세요.
          </p>
          <button
            onClick={() => { window.location.href = '/admin'; }}
            style={btnPrimary}
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
        <h1 style={titleStyle}>관리자 비밀번호 변경</h1>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 16 }}>
          보안을 위해 현재 비밀번호와 2단계 인증 코드를 모두 확인합니다.
        </p>
        {migrationNeeded && (
          <div style={{
            background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', color: '#5d4037',
            padding: 12, borderRadius: 6, fontSize: 12, marginBottom: 16, lineHeight: 1.5,
          }}>
            ⚠️ <b>DB 마이그레이션이 필요합니다.</b><br />
            Supabase Dashboard → SQL Editor에서 아래를 실행해주세요:
            <pre style={{
              background: '#fff', padding: 8, borderRadius: 4, marginTop: 6,
              fontSize: 11, overflow: 'auto',
            }}>{`ALTER TABLE sales_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];`}</pre>
          </div>
        )}

        <Label>현재 비밀번호</Label>
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          style={inputStyle}
          autoFocus
        />

        <Label style={{ marginTop: 12 }}>새 비밀번호 (8자 이상)</Label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          style={inputStyle}
        />

        <Label style={{ marginTop: 12 }}>새 비밀번호 확인</Label>
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          style={inputStyle}
          onKeyDown={(e) => { if (!needsMfa && e.key === 'Enter') submit(); }}
        />

        {needsMfa && (
          <>
            <Label style={{ marginTop: 12 }}>
              {useBackupCode ? '백업 코드 (8자)' : 'TOTP 6자리'}
            </Label>
            <input
              type="text"
              inputMode={useBackupCode ? 'text' : 'numeric'}
              maxLength={useBackupCode ? 8 : 6}
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ''))
              }
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: useBackupCode ? '0.2em' : '0.4em', textAlign: 'center' }}
              placeholder={useBackupCode ? 'a1b2c3d4' : '000000'}
            />
            <button
              onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--action)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0, marginTop: 6 }}
            >
              {useBackupCode ? '인증 앱 코드 사용' : '백업 코드 사용'}
            </button>
          </>
        )}

        {error && (
          <div style={{ color: 'var(--status-danger)', fontSize: 13, marginTop: 12 }}>{error}</div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          style={{
            ...btnPrimary,
            background: loading ? '#ddd' : 'var(--action)',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
        <button
          onClick={() => { window.location.href = '/admin'; }}
          style={{ ...btnPrimary, background: '#fff', color: 'var(--action)', border: '1px solid var(--action)', marginTop: 8 }}
        >
          취소
        </button>
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, ...style }}>
      {children}
    </label>
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
  marginTop: 0, marginBottom: 8, fontFamily: "'Cormorant Garamond', serif",
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: 40, fontSize: 14,
  border: '1.5px solid rgba(90,21,21,0.15)', borderRadius: 6,
  outline: 'none', padding: '0 12px', boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  width: '100%', height: 42, marginTop: 16,
  background: 'var(--action)', color: '#fff', border: 'none',
  borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
