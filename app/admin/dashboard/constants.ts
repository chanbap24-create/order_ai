import type { SourceMode } from './types';

export const PIE_COLORS = [
  '#8B1538', '#4D96FF', '#6BCB77', '#FF6B6B', '#FFD93D',
  '#9B59B6', '#FF8C42', '#00BCD4', 'var(--text-primary)', '#E91E63',
];

export const SOURCE_LABELS: Record<SourceMode, string> = {
  all: '전체', cdv: 'CDV', dl: 'DL',
};

export const SOURCE_COLORS: Record<SourceMode, string> = {
  all: '#8B1538', cdv: 'var(--action)', dl: '#2563eb',
};
