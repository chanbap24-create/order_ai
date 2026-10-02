'use client';

// 상세 시트 하단 — 눈에 띄지 않는 '수정 요청' 링크. 펼치면 유형 선택 + 내용 → 소믈리에 관리자에게 전송.
import { useState } from 'react';
import { REQUEST_CATEGORIES, type RequestCategory } from '@/app/lib/sommelierRequestTypes';

export function ChangeRequestForm({ itemNo, itemName, storeKey }: { itemNo: string; itemName: string; storeKey: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RequestCategory | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');

  const needsText = category === 'other';
  const valid = !!category && (!needsText || message.trim().length > 0);

  const send = async () => {
    if (!valid || state === 'sending') return;
    setState('sending'); setErr('');
    try {
      const res = await fetch('/api/sommelier/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemNo, itemName, category, message: message.trim(), storeKey }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '전송에 실패했습니다.');
      setState('sent');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '전송에 실패했습니다.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>요청을 보냈어요 — 관리자가 확인 후 반영합니다</div>;
  }

  if (!open) {
    return (
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <button onClick={() => setOpen(true)}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, color: 'var(--text-tertiary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          수정 요청
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>수정 요청</span>
        <button onClick={() => setOpen(false)}
          style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>취소</button>
      </div>
      {(Object.keys(REQUEST_CATEGORIES) as RequestCategory[]).map((k, i) => (
        <button key={k} onClick={() => setCategory(k)}
          style={{
            all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '11px 2px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5,
            fontWeight: category === k ? 700 : 400,
          }}>
          <i style={{
            flex: 'none', width: 8, height: 8, borderRadius: '50%',
            background: category === k ? 'var(--action)' : 'transparent',
            border: `1.5px solid ${category === k ? 'var(--action)' : 'var(--border-default)'}`,
          }} />
          {i + 1}. {REQUEST_CATEGORIES[k]}
        </button>
      ))}
      <textarea
        value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3}
        placeholder={needsText ? '요청 내용을 적어주세요 (필수)' : '추가 설명 (선택)'}
        style={{
          width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '10px 12px', fontSize: 16, resize: 'none',
          border: '1px solid var(--border-default)', borderRadius: 10, outline: 'none', background: 'var(--surface)', fontFamily: 'inherit',
        }} />
      {err && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--status-danger)' }}>{err}</div>}
      <button onClick={() => void send()} disabled={!valid || state === 'sending'}
        style={{
          display: 'block', width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 11, border: 'none',
          background: 'var(--action)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          opacity: valid && state !== 'sending' ? 1 : 0.4,
        }}>
        {state === 'sending' ? '보내는 중…' : '요청 보내기'}
      </button>
    </div>
  );
}
