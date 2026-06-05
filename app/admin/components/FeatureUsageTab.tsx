'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Section, PctBar } from './featureUsage/parts';
import {
  labelStyle, dateInput, selectStyle, chipBtn, primaryBtn,
  tableStyle, th, td, trBorder,
} from './featureUsage/styles';
import {
  todayKst, daysAgoKst, QUICK_RANGES,
  type UsageApiResp,
} from './featureUsage/dates';

export default function FeatureUsageTab() {
  const [start, setStart] = useState(daysAgoKst(6));
  const [end, setEnd] = useState(todayKst());
  const [manager, setManager] = useState('');
  const [data, setData] = useState<UsageApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ start, end });
      if (manager) params.set('manager', manager);
      const res = await fetch(`/api/admin/feature-usage?${params}`);
      const d = await res.json();
      if (!res.ok) { setError(d.error || '조회 실패'); setData(null); return; }
      setData(d);
    } catch {
      setError('조회 중 오류');
    } finally {
      setLoading(false);
    }
  }, [start, end, manager]);

  // start/end 동시 변경(quick range 버튼) 시 두 setState 가 두 번 fetch 트리거 → 200ms 디바운스
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchData(), 200);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [fetchData]);

  // 매니저 × 기능 매트릭스
  const matrix = useMemo(() => {
    if (!data) return null;
    const map = new Map<string, Map<string, number>>();
    for (const r of data.rows) {
      if (!map.has(r.manager)) map.set(r.manager, new Map());
      const m = map.get(r.manager)!;
      m.set(r.feature, (m.get(r.feature) || 0) + r.count);
    }
    return map;
  }, [data]);

  return (
    <div style={{ padding: 4 }}>
      {/* 필터 카드 */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
        border: '1px solid rgba(90,21,21,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        <div>
          <div style={labelStyle}>기간</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateInput} />
            <span style={{ color: 'var(--text-muted)' }}>~</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateInput} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {QUICK_RANGES.map(q => (
            <button key={q.label}
              onClick={() => { setStart(q.start()); setEnd(q.end()); }}
              style={chipBtn}>{q.label}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={labelStyle}>담당자 필터</div>
          <select value={manager} onChange={e => setManager(e.target.value)} style={selectStyle}>
            <option value="">전체</option>
            {(data?.managers || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={fetchData} disabled={loading} style={primaryBtn}>
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--status-danger)', padding: 8, fontSize: 13 }}>{error}</div>}

      {/* Top summary */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Card title="총 사용 횟수" value={data.total_count.toLocaleString()} />
          <Card title="활동 매니저" value={String(data.totals_by_manager.length)} />
          <Card title="사용된 기능" value={String(data.totals_by_feature.length)} />
          <Card title="활동 일수" value={String(data.days.length)} />
        </div>
      )}

      {data && data.totals_by_manager.length > 0 && (
        <Section title="담당자별 사용 합계">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>담당자</th>
                <th style={{ ...th, textAlign: 'right' }}>총 사용</th>
                <th style={{ ...th, width: '40%' }}>비율</th>
              </tr>
            </thead>
            <tbody>
              {data.totals_by_manager.map(r => {
                const pct = data.total_count > 0 ? (r.count / data.total_count) * 100 : 0;
                return (
                  <tr key={r.manager} style={trBorder}>
                    <td style={td}>{r.manager}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{r.count.toLocaleString()}</td>
                    <td style={td}><PctBar pct={pct} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {data && data.totals_by_feature.length > 0 && (
        <Section title="기능별 사용 합계">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>기능</th>
                <th style={{ ...th, textAlign: 'right' }}>총 사용</th>
                <th style={{ ...th, width: '40%' }}>비율</th>
              </tr>
            </thead>
            <tbody>
              {data.totals_by_feature.map(r => {
                const pct = data.total_count > 0 ? (r.count / data.total_count) * 100 : 0;
                return (
                  <tr key={r.feature} style={trBorder}>
                    <td style={td}>{r.feature}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{r.count.toLocaleString()}</td>
                    <td style={td}><PctBar pct={pct} color="#8B4513" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {data && matrix && data.totals_by_manager.length > 0 && (
        <Section title="담당자 × 기능 매트릭스">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...tableStyle, minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ ...th, position: 'sticky', left: 0, background: 'var(--gray-50)', zIndex: 1 }}>담당자</th>
                  {data.totals_by_feature.map(f => (
                    <th key={f.feature} style={{ ...th, textAlign: 'right', whiteSpace: 'nowrap' }}>{f.feature}</th>
                  ))}
                  <th style={{ ...th, textAlign: 'right', background: '#fff5f5' }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {data.totals_by_manager.map(m => {
                  const row = matrix.get(m.manager);
                  return (
                    <tr key={m.manager} style={trBorder}>
                      <td style={{ ...td, position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>{m.manager}</td>
                      {data.totals_by_feature.map(f => {
                        const v = row?.get(f.feature) || 0;
                        return (
                          <td key={f.feature} style={{ ...td, textAlign: 'right', color: v ? 'var(--text-primary)' : '#d0cfcd' }}>
                            {v ? v.toLocaleString() : '-'}
                          </td>
                        );
                      })}
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, background: '#fff5f5' }}>{m.count.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {data && data.rows.length > 0 && (
        <Section title="일자별 상세 (최신순)">
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>일자</th>
                  <th style={th}>담당자</th>
                  <th style={th}>기능</th>
                  <th style={{ ...th, textAlign: 'right' }}>횟수</th>
                  <th style={th}>마지막 사용</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} style={trBorder}>
                    <td style={td}>{r.usage_date}</td>
                    <td style={td}>{r.manager}</td>
                    <td style={td}>{r.feature}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{r.count.toLocaleString()}</td>
                    <td style={{ ...td, color: 'var(--text-tertiary)', fontSize: 11 }}>
                      {new Date(r.last_used_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {data && data.rows.length === 0 && !loading && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          해당 기간에 기록된 사용 내역이 없습니다.
        </div>
      )}
    </div>
  );
}
