'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatKrw } from '../lib/format';

// 범용 코로플레스(색칠 지도). GeoJSON을 순수 SVG로 투영 — 라이브러리/좌표/API 불필요.
// values: key→매출, keyOf: feature.properties→key, labelOf: 호버 라벨.

type GeoProps = Record<string, unknown>;
type GeoFeature = { properties: GeoProps; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
type Geo = { features: GeoFeature[] };

type Props = {
  url: string;
  values: Record<string, number>;
  keyOf: (props: GeoProps) => string;
  labelOf: (props: GeoProps) => string;
  width?: number;
};

const PAD = 10;

export function ChoroplethMap({ url, values, keyOf, labelOf, width = 460 }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hover, setHover] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(url);
        const j = await r.json();
        if (alive) setGeo(j);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [url]);

  // 투영은 geo/width 에만 의존(호버 때 재계산 방지). key/label 은 렌더 시 적용.
  const { shapes, H } = useMemo(() => {
    if (!geo) return { shapes: [] as { props: GeoProps; d: string }[], H: 300 };
    const feats: { props: GeoProps; polys: number[][][] }[] = [];
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
      feats.push({ props: f.properties, polys });
    }
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const x0 = minLon * k, dx = (maxLon - minLon) * k, dy = maxLat - minLat;
    const scale = (width - 2 * PAD) / dx;
    const height = dy * scale + 2 * PAD;
    const px = (lon: number) => PAD + (lon * k - x0) * scale;
    const py = (lat: number) => height - PAD - (lat - minLat) * scale;
    const ps = feats.map((f) => ({
      props: f.props,
      d: f.polys.map((ring) => 'M' + ring.map(([lon, lat]) => `${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join('L') + 'Z').join(''),
    }));
    return { shapes: ps, H: height };
  }, [geo, width]);

  const max = Math.max(1, ...Object.values(values));
  const fill = (key: string) => {
    const s = values[key] || 0;
    if (!s) return '#f0ece9';
    return `rgba(139,21,56,${(0.16 + 0.84 * (s / max)).toFixed(2)})`;
  };

  if (!geo) return <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center' }}>지도 불러오는 중…</div>;

  return (
    <div>
      <div style={{ height: 20, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        {hover
          ? <>{hover.label} · <span style={{ color: 'var(--action)' }}>{formatKrw(values[hover.key] || 0)}</span></>
          : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>지역에 마우스를 올리면 매출 표시</span>}
      </div>
      <svg viewBox={`0 0 ${width} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {shapes.map((sh, i) => {
          const key = keyOf(sh.props);
          const lbl = labelOf(sh.props);
          return (
            <path
              key={key + i}
              d={sh.d}
              fill={fill(key)}
              stroke={hover?.key === key ? 'var(--action)' : '#fff'}
              strokeWidth={hover?.key === key ? 1.6 : 0.6}
              style={{ cursor: 'pointer', transition: 'stroke 0.1s' }}
              onMouseEnter={() => setHover({ key, label: lbl })}
              onMouseLeave={() => setHover(null)}
            >
              <title>{lbl} {formatKrw(values[key] || 0)}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}
