'use client';

import { useEffect, useState } from 'react';

// 텔레그램 알림 연동 행 — 알림 탭 상단. 헤어라인 스타일(박스 카드 금지).
// 미연동: [연동하기] → 코드 발급 + t.me 딥링크 표시. 연동됨: 도트 + 해제.

export function TelegramLinkRow() {
  const [configured, setConfigured] = useState(false);
  const [linked, setLinked] = useState(false);
  const [code, setCode] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch('/api/sales/telegram-link', { headers: { 'X-Track-Skip': '1' } })
      .then((r) => r.json())
      .then((d) => { setConfigured(!!d.configured); setLinked(!!d.linked); })
      .catch(() => {});
  useEffect(() => { load(); }, []);

  // 코드 발급 후 연동 완료를 폴링 (봇에서 코드 입력 → linked 전환)
  useEffect(() => {
    if (!code || linked) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [code, linked]);

  if (!configured) return null; // 봇 미설정 시 노출 안 함

  const issue = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/sales/telegram-link', { method: 'POST' });
      const d = await r.json();
      if (d.code) { setCode(d.code); setDeepLink(d.deep_link || ''); }
    } finally { setBusy(false); }
  };
  const unlink = async () => {
    setBusy(true);
    try {
      await fetch('/api/sales/telegram-link', { method: 'DELETE' });
      setLinked(false); setCode('');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 2px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>텔레그램 알림</span>
      {linked ? (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--status-success, #16a34a)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />연동됨
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>매일 아침 수금 브리핑을 받습니다</span>
          <button onClick={unlink} disabled={busy} style={linkBtn}>해제</button>
        </>
      ) : code ? (
        <>
          <span style={{ color: 'var(--text-secondary)' }}>봇에게 코드 <b style={{ letterSpacing: 2, fontFamily: 'monospace' }}>{code}</b> 를 보내면 연동돼요</span>
          {deepLink && (
            <a href={deepLink} target="_blank" rel="noreferrer" style={{ color: 'var(--action)', fontWeight: 700, textDecoration: 'underline' }}>
              텔레그램 열기
            </a>
          )}
        </>
      ) : (
        <>
          <span style={{ color: 'var(--text-tertiary)' }}>수금 브리핑을 텔레그램으로 받아보세요</span>
          <button onClick={issue} disabled={busy} style={linkBtn}>연동하기</button>
        </>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border-default)', borderRadius: 7,
  background: 'var(--surface)', color: 'var(--text-secondary)',
};
