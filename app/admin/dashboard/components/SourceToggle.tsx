'use client';

import type { SourceMode } from '../types';
import { SOURCE_COLORS, SOURCE_LABELS } from '../constants';

type Props = {
  source: SourceMode;
  onChange: (s: SourceMode) => void;
};

export function SourceToggle({ source, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-light)' }}>
        분석 소스
      </span>
      <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {(['all', 'cdv', 'dl'] as SourceMode[]).map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: source === s ? SOURCE_COLORS[s] : 'transparent',
              color: source === s ? '#fff' : 'var(--color-text-light)',
              transition: 'all 0.15s',
            }}
          >
            {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-text-lighter)' }}>
        {source === 'all' ? '까브드뱅 + 대유라이프' : source === 'cdv' ? '까브드뱅 (와인)' : '대유라이프 (글라스)'}
      </span>
    </div>
  );
}
