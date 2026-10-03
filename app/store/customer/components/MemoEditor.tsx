'use client';

// 단골 카드 직원 메모 — 보기/수정 전환. 저장하면 수정자·날짜가 함께 남는다.
import { useState } from 'react';

export function MemoEditor({ memo, meta, onSave }: { memo: string; meta: string; onSave: (memo: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memo);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: memo ? 'var(--text-secondary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
          {memo || '선호·주의할 점을 남겨두면 다음 응대 때 도움이 돼요'}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 8 }}>
          {meta && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{meta}</span>}
          <button onClick={() => { setText(memo); setEditing(true); }}
            style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {memo ? '수정' : '메모 쓰기'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4} autoFocus
        placeholder="예) 부르고뉴 레드 선호, 무거운 와인은 싫어하심. 명절에 거래처 선물 구매."
        style={{
          width: '100%', boxSizing: 'border-box', padding: 10, fontSize: 16, lineHeight: 1.5, // 16px = iOS 확대 방지
          border: '1px solid var(--border-default)', borderRadius: 10, resize: 'vertical', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-primary)',
        }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 8 }}>
        <button onClick={() => setEditing(false)} style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)' }}>취소</button>
        <button disabled={busy}
          onClick={async () => { setBusy(true); const ok = await onSave(text); setBusy(false); if (ok) setEditing(false); }}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
