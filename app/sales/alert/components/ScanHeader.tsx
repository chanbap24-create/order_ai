'use client';

type Props = {
  isAdmin: boolean;
  currentManager: string;
  managers: string[];
  selectedManager: string;
  onSelectManager: (v: string) => void;
  scanning: boolean;
  onScan: () => void;
  lastScanned: string | null;
  onShowDismissed: () => void;
};

export function ScanHeader(p: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
    }}>
      {p.isAdmin ? (
        <select
          value={p.selectedManager}
          onChange={e => p.onSelectManager(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(90,21,21,0.08)',
            fontSize: 16, background: 'white', color: '#2c1810',
            flex: '1 1 auto', minWidth: 120, maxWidth: 200,
          }}
        >
          <option value="">담당자 선택</option>
          {p.managers.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2c1810' }}>{p.currentManager}</span>
      )}

      <button
        onClick={p.onScan}
        disabled={!p.selectedManager || p.scanning}
        style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: !p.selectedManager || p.scanning ? '#ccc' : '#5A1515', color: 'white',
          fontSize: 13, fontWeight: 600, cursor: !p.selectedManager || p.scanning ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={p.scanning ? { animation: 'spin 1s linear infinite' } : {}}
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
        {p.scanning ? '스캔 중...' : '재고 스캔'}
      </button>

      {p.lastScanned && (
        <span style={{ fontSize: 11, color: '#a8a098' }}>
          {new Date(p.lastScanned).toLocaleString('ko-KR', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={p.onShowDismissed}
        style={{
          padding: '6px 12px', borderRadius: 8,
          border: '1.5px solid rgba(90,21,21,0.08)', background: 'white', color: '#8a8580',
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        제외 관리
      </button>
    </div>
  );
}
