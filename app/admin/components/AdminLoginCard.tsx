'use client';

type Props = {
  pin: string;
  setPin: (v: string) => void;
  error: boolean;
  setError: (v: boolean) => void;
  loginLoading: boolean;
  mfaRequired: boolean;
  setMfaRequired: (v: boolean) => void;
  mfaCode: string;
  setMfaCode: (v: string) => void;
  mfaError: string;
  setMfaError: (v: string) => void;
  useBackupCode: boolean;
  setUseBackupCode: (v: boolean) => void;
  onLogin: () => void;
};

export default function AdminLoginCard(p: Props) {
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'var(--surface-muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        border: '1px solid var(--action-muted)',
        padding: '40px 32px', width: 320, textAlign: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>관리자 인증</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          {p.mfaRequired
            ? (p.useBackupCode ? '백업 코드를 입력하세요' : '인증 앱 6자리 코드')
            : '비밀번호를 입력하세요'}
        </div>
        {!p.mfaRequired && (
          <input
            type="password"
            autoComplete="current-password"
            value={p.pin}
            onChange={e => { p.setPin(e.target.value); p.setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') p.onLogin(); }}
            placeholder=""
            autoFocus
            style={{
              width: '100%', height: 44, fontSize: 24, textAlign: 'center',
              letterSpacing: '0.3em',
              border: `1.5px solid ${p.error ? 'var(--status-danger)' : 'var(--border-default)'}`,
              borderRadius: 6, outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
        )}
        {p.mfaRequired && (
          <input
            type="text"
            autoComplete={p.useBackupCode ? 'off' : 'one-time-code'}
            inputMode={p.useBackupCode ? 'text' : 'numeric'}
            value={p.mfaCode}
            onChange={e => { p.setMfaCode(e.target.value); p.setMfaError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') p.onLogin(); }}
            placeholder={p.useBackupCode ? '8자리 영숫자' : '000000'}
            maxLength={p.useBackupCode ? 8 : 6}
            autoFocus
            style={{
              width: '100%', height: 44, fontSize: 22, textAlign: 'center',
              letterSpacing: p.useBackupCode ? '0.2em' : '0.4em',
              border: `1.5px solid ${p.mfaError ? 'var(--status-danger)' : 'var(--border-default)'}`,
              borderRadius: 6, outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s', fontFamily: 'monospace',
            }}
          />
        )}
        {p.error && !p.mfaRequired && (
          <div style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 8 }}>비밀번호가 틀렸습니다</div>
        )}
        {p.mfaError && (
          <div style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 8 }}>{p.mfaError}</div>
        )}
        <button
          onClick={p.onLogin}
          disabled={(p.mfaRequired ? p.mfaCode.length < (p.useBackupCode ? 8 : 6) : p.pin.length < 1) || p.loginLoading}
          style={{
            width: '100%', height: 40, marginTop: 16,
            background: ((p.mfaRequired ? p.mfaCode.length >= (p.useBackupCode ? 8 : 6) : p.pin.length >= 1) && !p.loginLoading) ? 'var(--action)' : 'var(--gray-300)',
            color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: ((p.mfaRequired ? p.mfaCode.length >= (p.useBackupCode ? 8 : 6) : p.pin.length >= 1) && !p.loginLoading) ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
        >
          {p.loginLoading ? '확인 중...' : (p.mfaRequired ? '인증' : '확인')}
        </button>
        {p.mfaRequired && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <button
              onClick={() => { p.setUseBackupCode(!p.useBackupCode); p.setMfaCode(''); p.setMfaError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--action)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              {p.useBackupCode ? '인증 앱 코드로 변경' : '백업 코드 사용'}
            </button>
            <button
              onClick={() => { p.setMfaRequired(false); p.setMfaCode(''); p.setMfaError(''); p.setPin(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 12, padding: 0 }}
            >
              비밀번호부터 다시
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
