'use client';

// 메시지 패널 — 직원용/거래처용 서브탭 + 본문 + 복사. 복사 시(직원용) 정정 학습이 저장된다.
// which는 부모(page)가 소유 — 하단 고정 바의 복사 버튼이 같은 탭을 따라가야 하므로.

export function MessagePanel({ staffMessage, clientMessage, copied, onCopy, which, setWhich }: {
  staffMessage: string; clientMessage: string;
  copied: '' | 'staff' | 'client';
  onCopy: (which: 'staff' | 'client') => void;
  which: 'staff' | 'client';
  setWhich: (w: 'staff' | 'client') => void;
}) {
  const text = which === 'staff' ? staffMessage : clientMessage;

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--border-default)' }}>
        {([['staff', '직원용 발주'], ['client', '거래처 전달']] as const).map(([k, label], i) => (
          <button key={k} onClick={() => setWhich(k)}
            style={{
              all: 'unset', cursor: 'pointer', padding: '9px 14px', fontSize: 13.5,
              fontWeight: which === k ? 700 : 400,
              color: which === k ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            }}>
            {label}
          </button>
        ))}
        <button onClick={() => onCopy(which)}
          style={{
            marginLeft: 'auto', padding: '8px 18px', fontSize: 13, fontWeight: 700,
            background: copied === which ? 'var(--status-success)' : 'var(--action)',
            color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', marginBottom: 6,
          }}>
          {copied === which ? '복사됨 ✓' : '복사'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '14px 2px', fontSize: 13, lineHeight: 1.65,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'inherit', color: 'var(--text-secondary)',
      }}>
        {text || '분석 결과가 있으면 메시지가 생성됩니다.'}
      </pre>
    </section>
  );
}
