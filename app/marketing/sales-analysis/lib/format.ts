export function fmt(n: number) { return n.toLocaleString(); }

export function fmtM(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
  if (n >= 10000) return Math.round(n / 10000).toLocaleString() + '만';
  return fmt(n);
}

export function pct(part: number, total: number) {
  return total > 0 ? Math.round(part / total * 100) : 0;
}

export const TYPE_COLORS: Record<string, string> = {
  'Champagne': '#C4A35A', 'Sparkling': '#4A90D9', 'Red': '#8B1A1A', 'White': '#DAA520',
  'Rosé': '#D4728A', 'Icewine': '#5BA3CF', 'Grappa': '#8B6914',
  'Set': '#2E7D32', 'POS Material': '#FF6F00', '자재': '#78909C',
  'Port': '#6B2D5B', '타사제품': 'var(--neutral-400)',
};

export const TYPE_BG: Record<string, string> = {
  'Champagne': 'rgba(196,163,90,0.08)', 'Sparkling': 'rgba(74,144,217,0.08)',
  'Red': 'rgba(139,26,26,0.08)', 'White': 'rgba(218,165,32,0.08)',
  'Rosé': 'rgba(212,114,138,0.08)', 'Icewine': 'rgba(91,163,207,0.08)',
  'Grappa': 'rgba(139,105,20,0.08)', 'Set': 'rgba(46,125,50,0.08)',
  'POS Material': 'rgba(255,111,0,0.08)', '자재': 'rgba(120,144,156,0.08)',
  'Port': 'rgba(107,45,91,0.08)', '타사제품': 'rgba(102,102,102,0.08)',
};
