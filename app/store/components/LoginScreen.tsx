'use client';

// 매장 앱 직원 로그인 — 기존 sales 계정(POST /api/auth/login).
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { GOLD_LINE, LAT } from '../brand';

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16,
  border: '1px solid var(--border-default)', borderRadius: 11, outline: 'none', background: 'var(--surface)',
};

export function LoginScreen({ onLogin }: { onLogin: (m: string, p: string) => Promise<string> }) {
  const [manager, setManager] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!manager.trim() || !password) return;
    setBusy(true); setErr('');
    const e = await onLogin(manager.trim(), password);
    if (e) setErr(e);
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '18vh 24px 40px' }}>
      <h1 style={{ ...LAT, fontSize: 17, margin: '0 0 6px' }}>CAVE DE VIN</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>매장 재고 — 직원 로그인</p>
      <div style={{ height: 1, background: GOLD_LINE, margin: '18px 0 24px' }} />
      <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="이름" autoComplete="username" style={inputStyle} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" type="password" autoComplete="current-password"
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        style={{ ...inputStyle, marginTop: 10 }} />
      {err && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--status-danger)' }}>{err}</div>}
      <button onClick={() => void submit()} disabled={busy}
        style={{ marginTop: 16, width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, background: 'var(--action)', color: '#fff', border: 'none', borderRadius: 11, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '로그인 중…' : '로그인'}
      </button>
    </div>
  );
}
