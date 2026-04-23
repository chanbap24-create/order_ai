'use client';

type Props = {
  todayLabel: string;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  generating: boolean;
  onGenerateAll: () => void;
};

export function BriefingHeader({ todayLabel, totalCount, completedCount, pendingCount, generating, onGenerateAll }: Props) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a237e, #4a148c)',
      borderRadius: 12, padding: 16, color: '#fff', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{todayLabel} 브리핑</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>오늘 미팅 {totalCount}건</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{completedCount}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>준비됨</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{pendingCount}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>미준비</div>
          </div>
        </div>
      </div>

      {pendingCount > 0 && (
        <button
          onClick={onGenerateAll}
          disabled={generating}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, border: 'none',
            background: generating ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: generating ? 'default' : 'pointer',
          }}
        >
          {generating ? '생성 중...' : `미준비 ${pendingCount}건 일괄 브리핑 생성`}
        </button>
      )}
    </div>
  );
}
