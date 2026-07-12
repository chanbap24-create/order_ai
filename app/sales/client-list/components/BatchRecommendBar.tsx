'use client';

type Props = {
  count: number;
  running: boolean;
  progress: { done: number; total: number; name: string };
  message: string | null;
  onRun: () => void;
  onClear: () => void;
};

/** 거래처 다중 선택 → 추천견적 일괄 생성 액션 바. 1곳=단일 xlsx, 복수=ZIP. */
export function BatchRecommendBar({ count, running, progress, message, onRun, onClear }: Props) {
  const idle = count === 0 && !running && !message;
  if (idle) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 12,
      padding: '10px 14px',
    }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        {running ? (
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            추천견적 생성 중… {progress.done}/{progress.total}
            {progress.name ? ` · ${progress.name}` : ''}
          </span>
        ) : message ? (
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{message}</span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {count}곳 선택됨
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              추천견적 탭 설정 그대로 적용 · 1곳=엑셀, 여러 곳=ZIP
            </span>
          </span>
        )}
      </div>

      {count > 0 && !running && (
        <button onClick={onClear} style={{
          padding: '7px 12px', borderRadius: 8, border: '1px solid var(--gray-300)',
          background: '#fff', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer',
        }}>선택 해제</button>
      )}
      <button
        onClick={onRun}
        disabled={running || count === 0}
        style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: running || count === 0 ? 'var(--gray-300)' : 'var(--action)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: running || count === 0 ? 'default' : 'pointer',
        }}
      >
        {running ? '생성 중…' : `추천견적 한꺼번에 받기${count > 0 ? ` (${count}곳)` : ''}`}
      </button>
    </div>
  );
}
