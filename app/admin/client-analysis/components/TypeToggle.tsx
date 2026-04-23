'use client';

import type { AnalysisType } from '../types';

export function TypeToggle({ type, onChange }: { type: AnalysisType; onChange: (t: AnalysisType) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {(['wine', 'glass'] as const).map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-md)',
            border: type === t ? '2px solid #8B1538' : '1px solid var(--color-border)',
            background: type === t ? 'rgba(139,21,56,0.08)' : 'var(--color-card)',
            color: type === t ? '#8B1538' : 'var(--color-text)',
            fontWeight: type === t ? 700 : 500,
            fontSize: 'var(--text-sm)', cursor: 'pointer',
          }}
        >
          {t === 'wine' ? 'Wine (CDV)' : 'Glass (DL)'}
        </button>
      ))}
    </div>
  );
}
