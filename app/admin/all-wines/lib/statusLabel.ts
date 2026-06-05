import type { WineRow } from '../types';

export function statusLabel(w: WineRow) {
  if (w.approved) return { text: '승인', color: 'var(--status-success)', bg: '#dcfce7' };
  if (w.ai_generated) return { text: '조사완료', color: '#ca8a04', bg: '#fef9c3' };
  if (w.status === 'new') return { text: '신규', color: 'var(--status-info)', bg: '#dbeafe' };
  return { text: '기존', color: 'var(--gray-500)', bg: 'var(--gray-100)' };
}
