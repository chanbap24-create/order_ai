'use client';

type Props = {
  totalWeight: number;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
};

export function ActionBar({ totalWeight, saving, onReset, onSave }: Props) {
  const totalColor = totalWeight === 100 ? '#4CAF50' : totalWeight > 90 && totalWeight < 110 ? '#FF9800' : '#c62828';

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1.5px solid rgba(90,21,21,0.08)',
      padding: '12px 16px', zIndex: 200,
      boxShadow: '0 -2px 10px rgba(90,21,21,0.08)',
    }}>
      <div style={{ maxWidth: 1250, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 12, color: '#8a8580' }}>
          가중치 합계: <span style={{ fontWeight: 700, color: totalColor }}>{totalWeight}점</span>
          {totalWeight !== 100 && <span style={{ color: '#FF9800', marginLeft: 8 }}>(권장: 100점)</span>}
        </div>
        <button
          onClick={onReset}
          style={{
            padding: '10px 20px', borderRadius: 8, border: '1.5px solid rgba(90,21,21,0.08)',
            background: '#fff', color: '#8a8580', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          초기화
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: saving ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
