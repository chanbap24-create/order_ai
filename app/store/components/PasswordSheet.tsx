'use client';

// 비밀번호 변경 시트 — 매장 앱(재고·소믈리에) 메뉴 공용. 현재 비밀번호 확인 후 변경(기존 /api/auth/password).
import { useState } from 'react';
import { createPortal } from 'react-dom';

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 2px', fontSize: 16, // 16px = iOS 확대 방지
  border: 'none', borderBottom: '1px solid var(--border-default)', outline: 'none', background: 'transparent', color: 'var(--text-primary)',
};

export function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!cur || !next) { setMsg({ ok: false, text: '현재 비밀번호와 새 비밀번호를 입력하세요.' }); return; }
    if (next.length < 4) { setMsg({ ok: false, text: '새 비밀번호는 4자 이상이어야 합니다.' }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: '새 비밀번호가 서로 다릅니다.' }); return; }
    if (next === cur) { setMsg({ ok: false, text: '현재와 다른 비밀번호를 입력하세요.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: cur, new_password: next }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.success !== false) {
        setMsg({ ok: true, text: '비밀번호를 변경했습니다.' });
        setTimeout(onClose, 1200);
      } else setMsg({ ok: false, text: j?.error || '변경에 실패했습니다.' });
    } catch { setMsg({ ok: false, text: '네트워크를 확인하세요.' }); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{
          width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '12px 12px 0 0',
          padding: '10px 22px calc(24px + env(safe-area-inset-bottom))', color: 'var(--text-primary)',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>비밀번호 변경</span>
          <button type="button" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
        </div>
        <input type="password" autoComplete="current-password" placeholder="현재 비밀번호" value={cur} onChange={(e) => setCur(e.target.value)} style={input} />
        <input type="password" autoComplete="new-password" placeholder="새 비밀번호" value={next} onChange={(e) => setNext(e.target.value)} style={input} />
        <input type="password" autoComplete="new-password" placeholder="새 비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} />
        {msg && <p style={{ margin: '12px 0 0', fontSize: 12.5, color: msg.ok ? 'var(--status-success)' : 'var(--status-danger)' }}>{msg.text}</p>}
        <button type="submit" disabled={busy}
          style={{ display: 'block', width: '100%', marginTop: 18, padding: '14px 0', borderRadius: 11, border: 'none', background: 'var(--action)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? '변경 중…' : '변경하기'}
        </button>
      </form>
    </div>,
    document.body,
  );
}
