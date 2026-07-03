'use client';

import { useEffect, useState } from 'react';
import Card from '@/app/components/ui/Card';
import { formatKrw } from '../lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from '../lib/recharts';
import { ChoroplethMap } from './ChoroplethMap';

type Row = { sido: string; gu: string; sales: number; clients: number };
type Props = { type: 'wine' | 'glass'; startDate: string; endDate: string };

const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 };

// 전국 시군구 GeoJSON code 접두 2자리 → 시도 (fn_region_sales 의 sido 정규화와 동일 키)
const CODE_SIDO: Record<string, string> = {
  '11': '서울', '21': '부산', '22': '대구', '23': '인천', '24': '광주', '25': '대전', '26': '울산', '29': '세종',
  '31': '경기', '32': '강원', '33': '충북', '34': '충남', '35': '전북', '36': '전남', '37': '경북', '38': '경남', '39': '제주',
};
const sidoOfCode = (code: unknown) => CODE_SIDO[String(code).slice(0, 2)] || '기타';

export function RegionSalesCard({ type, startDate, endDate }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState<'korea' | 'seoul'>('korea');

  useEffect(() => {
    if (!startDate || !endDate) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/client-analysis/region?type=${type}&startDate=${startDate}&endDate=${endDate}`);
        const j = await res.json();
        if (!alive) return;
        setRows(Array.isArray(j.rows)
          ? j.rows.map((x: Row) => ({ sido: x.sido, gu: x.gu, sales: Number(x.sales) || 0, clients: Number(x.clients) || 0 }))
          : []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [type, startDate, endDate]);

  // 시도 집계 + 구 랭킹
  const sidoMap = new Map<string, number>();
  const guMap = new Map<string, { sido: string; gu: string; sales: number; clients: number }>();
  for (const r of rows) {
    sidoMap.set(r.sido, (sidoMap.get(r.sido) || 0) + r.sales);
    const k = `${r.sido}|${r.gu}`;
    const g = guMap.get(k) || { sido: r.sido, gu: r.gu, sales: 0, clients: 0 };
    g.sales += r.sales; g.clients += r.clients; guMap.set(k, g);
  }
  const sidoData = [...sidoMap.entries()].map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales).slice(0, 12);
  const total = [...sidoMap.values()].reduce((s, v) => s + v, 0);
  const guData = [...guMap.values()].filter((g) => g.gu !== '(구외)').sort((a, b) => b.sales - a.sales).slice(0, 15);
  const guMax = guData[0]?.sales || 1;

  // 지도용 매출 맵: 전국='시도|시군구' / 서울='구명'
  const salesBySidoGu: Record<string, number> = {};
  const seoulByGu: Record<string, number> = {};
  for (const g of guMap.values()) {
    if (g.gu === '(구외)') continue;
    salesBySidoGu[`${g.sido}|${g.gu}`] = (salesBySidoGu[`${g.sido}|${g.gu}`] || 0) + g.sales;
    if (g.sido === '서울') seoulByGu[g.gu] = (seoulByGu[g.gu] || 0) + g.sales;
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.01em' }}>
          지역별 매출
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>거래처 주소 기준 · 총 {formatKrw(total)}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>로딩 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>주소가 매칭된 매출이 없습니다.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {/* 시도별 가로 막대 */}
            <div>
              <div style={label}>시도별</div>
              <ResponsiveContainer width="100%" height={Math.max(220, sidoData.length * 26)}>
                <BarChart data={sidoData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--gray-200, #eee)" />
                  <XAxis type="number" tickFormatter={(v: number) => (v >= 1e8 ? `${Math.round(v / 1e8)}억` : `${Math.round(v / 1e4)}만`)} fontSize={11} stroke="var(--text-tertiary)" />
                  <YAxis type="category" dataKey="name" width={44} fontSize={11} stroke="var(--text-tertiary)" />
                  <Tooltip formatter={(v: number) => [formatKrw(Number(v)), '매출']} />
                  <Bar dataKey="sales" fill="#8B1538" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 지역 지도(코로플레스) — 전국/서울 토글 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span style={{ ...label, marginBottom: 0 }}>{mapMode === 'korea' ? '전국 시군구 지도' : '서울 자치구 지도'}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['korea', '전국'], ['seoul', '서울']] as const).map(([m, t]) => (
                    <button key={m} onClick={() => setMapMode(m)} style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--gray-300)', background: mapMode === m ? 'var(--action)' : '#fff', color: mapMode === m ? '#fff' : 'var(--text-secondary)' }}>{t}</button>
                  ))}
                </div>
              </div>
              {mapMode === 'korea'
                ? <ChoroplethMap url="/korea-districts.geojson" values={salesBySidoGu} width={440}
                    keyOf={(p) => `${sidoOfCode(p.code)}|${p.name}`}
                    labelOf={(p) => `${sidoOfCode(p.code)} ${p.name}`} />
                : <ChoroplethMap url="/seoul-districts.geojson" values={seoulByGu} width={460}
                    keyOf={(p) => String(p.name)} labelOf={(p) => String(p.name)} />}
            </div>
          </div>

          {/* 구별 상위 15 */}
          <div style={{ marginTop: 20 }}>
            <div style={label}>구별 상위 15</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', columnGap: 24, rowGap: 6 }}>
              {guData.map((g) => (
                <div key={`${g.sido}|${g.gu}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 110, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                    {g.sido} {g.gu}
                  </span>
                  <div style={{ flex: 1, height: 14, background: 'var(--surface-muted, #f3f0ee)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (g.sales / guMax) * 100)}%`, height: '100%', background: '#8B1538', borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 58, flexShrink: 0, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{formatKrw(g.sales)}</span>
                  <span style={{ width: 40, flexShrink: 0, textAlign: 'right', color: 'var(--text-tertiary)' }}>{g.clients}곳</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
