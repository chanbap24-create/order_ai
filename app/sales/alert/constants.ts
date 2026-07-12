// Level 0: 다른 빈티지, 1: 같은 서브리전+동급, 2: 같은 서브리전,
// 3: 같은 대지역, 4: 같은 슈퍼리전, 5: 같은 국가, 6: 같은 품종(글로벌)
export const LEVEL_COLORS: Record<number, string> = {
  0: '#6A1B9A',
  1: '#1B5E20',
  2: 'var(--status-success)',
  3: 'var(--status-info)',
  4: '#5C6BC0',
  5: 'var(--status-warning)',
  6: '#bf360c',
};
