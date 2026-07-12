'use client';

import { useEffect, useState } from 'react';
import { VENUE_GROUPS, VENUE_MAP } from '@/app/lib/venueTypes';

type Props = { clientCode: string; clientType: 'wine' | 'glass'; onSaved?: (venue: string) => void };

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12,
  padding: '14px 16px', marginBottom: 12,
};
const title: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' };

/** 거래처 업장 유형 선택(태깅). 저장 즉시 반영. 추천 프로파일 근거로 쓰임. */
export function ClientVenueCard({ clientCode, clientType, onSaved }: Props) {
  const [venue, setVenue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
    const prev = venue;
    setVenue(v); setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch('/api/sales/clients/venue', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: clientCode, type: clientType, venue: v }),
      });
      if (!res.ok) {
        // 실패 시 선택 되돌리고 진짜 원인을 노출(그동안 조용히 삼켜 '미지정 복귀'로만 보였음).
        const j = await res.json().catch(() => ({}));
        setVenue(prev);
        setError(j?.error || (res.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : res.status === 403 ? '이 거래처를 수정할 권한이 없습니다(담당자·부서 확인).' : `저장 실패 (${res.status})`));
        return;
      }
      setSaved(true); setTimeout(() => setSaved(false), 1500);
      onSaved?.(v); // 부모(리스트)에 즉시 반영
    } catch {
      setVenue(prev); setError('네트워크 오류로 저장하지 못했습니다.');
    } finally { setSaving(false); }
  };

  const info = venue ? VENUE_MAP[venue] : null;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={title}>업장 유형</span>
        {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>저장 중…</span>}
        {saved && <span style={{ fontSize: 11, color: 'var(--status-success)' }}>✓ 저장됨</span>}
        {error && <span style={{ fontSize: 11, color: 'var(--status-danger)' }}>⚠ {error}</span>}
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
