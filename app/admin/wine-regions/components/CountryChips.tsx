'use client';

import { COUNTRIES } from '../constants';

type Props = {
  selectedCountry: string;
  countryCounts: Record<string, number>;
  totalRegions: number;
  onSelect: (v: string) => void;
};

export function CountryChips({ selectedCountry, countryCounts, totalRegions, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {COUNTRIES.map(c => {
        const isActive = selectedCountry === c.value;
        const cnt = c.value ? (countryCounts[c.value] || 0) : totalRegions;
        return (
          <button
            key={c.value}
            onClick={() => onSelect(c.value)}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: isActive ? '#5A1515' : 'rgba(90,21,21,0.05)',
              color: isActive ? '#fff' : '#8a8580',
            }}
          >
            {c.flag && <span style={{ marginRight: 4 }}>{c.flag}</span>}
            {c.label}
            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>{cnt}</span>
          </button>
        );
      })}
    </div>
  );
}
