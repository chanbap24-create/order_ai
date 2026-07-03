'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatKrw } from '../lib/format';

// 서울 자치구 코로플레스(색칠 지도). GeoJSON(public/seoul-districts.geojson)을 순수 SVG로 투영.
// 좌표/지오코딩 불필요 — 구 경계만 있으면 됨. salesByGu: { '강남구': 매출, ... }.

type GeoFeature = { properties: { name: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
type Geo = { features: GeoFeature[] };

const W = 500, H = 400, PAD = 12;

export function SeoulSalesMap({ salesByGu }: { salesByGu: Record<string, number> }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/seoul-districts.geojson');
        const j = await r.json();
        if (alive) setGeo(j);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const paths = useMemo(() => {
    if (!geo) return [] as { name: string; d: string }[];
    const rings: { name: string; polys: number[][][] }[] = [];
    let minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
    for (const f of geo.features) {
      const g = f.geometry;
      const polys: number[][][] = g.type === 'Polygon'
        ? (g.coordinates as number[][][])
        : (g.coordinates as number[][][][]).flat();
      for (const ring of polys) for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }
      rings.push({ name: f.properties.name, polys });
    }
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180); // 경도 보정(위도별 거리차)
    const x0 = minLon * k, dx = (maxLon - minLon) * k, dy = maxLat - minLat;
    const scale = Math.min((W - 2 * PAD) / dx, (H - 2 * PAD) / dy);
    const offX = (W - dx * scale) / 2, offY = (H - dy * scale) / 2;
    const px = (lon: number) => offX + (lon * k - x0) * scale;
    const py = (lat: number) => H - offY - (lat - minLat) * scale;
    return rings.map((r) => ({
      name: r.name,
      d: r.polys.map((ring) => 'M' + ring.map(([lon, lat]) => `${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join('L') + 'Z').join(''),
    }));
  }, [geo]);

  const max = Math.max(1, ...Object.values(salesByGu));
  const fill = (name: string) => {
    const s = salesByGu[name] || 0;
    if (!s) return '#f0ece9';
    return `rgba(139,21,56,${(0.16 + 0.84 * (s / max)).toFixed(2)})`;
  };

  if (!geo) return <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center' }}>지도 불러오는 중…</div>;

  return (
    <div>
      <div style={{ height: 20, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
        {hover ? <>{hover} · <span style={{ color: 'var(--action)' }}>{formatKrw(salesByGu[hover] || 0)}</span></> : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>구에 마우스를 올리면 매출 표시</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {paths.map((p) => (
          <path
            key={p.name}
            d={p.d}
            fill={fill(p.name)}
            stroke={hover === p.name ? 'var(--action)' : '#fff'}
            strokeWidth={hover === p.name ? 2 : 0.8}
            style={{ cursor: 'pointer', transition: 'stroke 0.1s' }}
            onMouseEnter={() => setHover(p.name)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{p.name} {formatKrw(salesByGu[p.name] || 0)}</title>
          </path>
        ))}
      </svg>
    </div>
  );
}
