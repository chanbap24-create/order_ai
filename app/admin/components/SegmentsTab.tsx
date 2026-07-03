'use client';
import { useEffect, useState, useCallback } from 'react';
import { SegmentProfileTable, type SegmentProfile } from '../segments/SegmentProfileTable';

// 업장유형·지역별 구매 프로파일 — 신규 거래처(이력 0) 추천에 활용되는 데이터.
export default function SegmentsTab() {
  const [profiles, setProfiles] = useState<SegmentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/segment-profiles');
      const j = await r.json();
      setProfiles(j.profiles || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true); setMsg('');
    try {
      const r = await fetch('/api/admin/segment-profiles', { method: 'POST' });
      const j = await r.json();
      if (j.success) { setMsg(`갱신 완료 · 업장 ${j.venues}종 · 지역 ${j.regions}곳 · 출고 ${j.lines?.toLocaleString()}행`); await load(); }
      else setMsg('갱신 실패: ' + (j.error || '알 수 없음'));
    } catch (e) { setMsg('갱신 오류: ' + (e instanceof Error ? e.message : '')); }
    finally { setRefreshing(false); }
  };

  const venues = profiles.filter((p) => p.segment_type === 'venue');
  const bizTypes = profiles.filter((p) => p.segment_type === 'business_type');
  const regions = profiles.filter((p) => p.segment_type === 'region');
  const updatedAt = (profiles[0] as SegmentProfile & { updated_at?: string })?.updated_at;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>업장유형·지역별 구매 프로파일</div>
          <div style={{ color: '#6b7280', fontSize: 12.5 }}>신규 거래처(이력 없음) 추천에 활용 · 최근 12개월 출고 집계{updatedAt ? ` · 갱신 ${updatedAt.slice(0, 16).replace('T', ' ')}` : ''}</div>
        </div>
        <button onClick={refresh} disabled={refreshing} style={btn}>{refreshing ? '갱신 중…' : '데이터 갱신'}</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: '#5a1515', margin: '8px 0' }}>{msg}</div>}

      <h3 style={h3}>업장유형별 (스시·프렌치·이탈리안 등)</h3>
      {loading ? <div style={mut}>불러오는 중…</div> : <SegmentProfileTable profiles={venues} />}

      <h3 style={h3}>업태별 (on/업소·on/샵·도매장 등 · 데이터 많음)</h3>
      {loading ? <div style={mut}>불러오는 중…</div> : <SegmentProfileTable profiles={bizTypes} />}

      <h3 style={h3}>지역별 (시/구)</h3>
      {loading ? <div style={mut}>불러오는 중…</div> : <SegmentProfileTable profiles={regions} />}
    </div>
  );
}

const h3: React.CSSProperties = { fontSize: 14, margin: '22px 0 8px', paddingLeft: 8, borderLeft: '4px solid #5a1515' };
const mut: React.CSSProperties = { color: '#9ca3af', fontSize: 13, padding: 8 };
const btn: React.CSSProperties = { background: '#5a1515', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
