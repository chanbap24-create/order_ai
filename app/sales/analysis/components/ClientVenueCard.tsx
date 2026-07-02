'use client';

import { useEffect, useState } from 'react';
import { VENUE_GROUPS, VENUE_MAP } from '@/app/lib/venueTypes';

type Props = { clientCode: string; clientType: 'wine' | 'glass' };

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12,
  padding: '14px 16px', marginBottom: 12,
};
const title: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' };

/** 거래처 업장 유형 선택(태깅). 저장 즉시 반영. 추천 프로파일 근거로 쓰임. */
export function ClientVenueCard({ clientCode, clientType }: Props) {
  const [venue, setVenue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/sales/clients/venue?client_code=${encodeURIComponent(clientCode)}&type=${clientType}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (alive) setVenue(j?.venue || ''); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientCode, clientType]);

  const save = async (v: string) => {
    setVenue(v); setSaving(true); setSaved(false);
    try {
      await fetch('/api/sales/clients/venue', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: clientCode, type: clientType, venue: v }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const info = venue ? VENUE_MAP[venue] : null;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={title}>업장 유형</span>
        {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>저장 중…</span>}
        {saved && <span style={{ fontSize: 11, color: '#16a34a' }}>✓ 저장됨</span>}
      </div>
      <select value={venue} onChange={(e) => save(e.target.value)} disabled={loading}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-300)', borderRadius: 8, fontSize: 14, background: '#fff', color: 'var(--text-primary)' }}>
        <option value="">— 미지정 (구매이력 기반) —</option>
        {VENUE_GROUPS.map((g) => (
          <optgroup key={g.category} label={g.label}>
            {g.items.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
          </optgroup>
        ))}
      </select>
      {info && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
          🍷 추천 방향: {info.wine}
        </div>
      )}
    </div>
  );
}
