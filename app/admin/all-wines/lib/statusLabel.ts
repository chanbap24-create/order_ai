import type { WineRow } from '../types';

export function statusLabel(w: WineRow) {
  if (w.approved) return { text: '승인', color: '#16a34a', bg: '#dcfce7' };
  if (w.ai_generated) return { text: '조사완료', color: '#ca8a04', bg: '#fef9c3' };
  if (w.status === 'new') return { text: '신규', color: '#2563eb', bg: '#dbeafe' };
  return { text: '기존', color: '#6b7280', bg: '#f3f4f6' };
}
