'use client';

export interface SegmentProfile {
  segment_type: string; segment_key: string; label: string;
  client_count: number; bottle_count: number;
  price_median: number; price_p25: number; price_p75: number;
  type_dist: Record<string, number>;
  top_countries: { country: string; share: number }[];
  top_items: { item_no: string; name: string; breadth: number; qty: number }[];
}

const TC: Record<string, string> = { '스파클링': '#d97706', '화이트': '#ca8a04', '레드': '#991b1b', '로제': '#db2777', '주정강화': '#7c3aed', '기타': '#9ca3af' };
const won = (n: number) => (n ? n.toLocaleString() + '원' : '-');

function TypeBar({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div style={{ display: 'flex', width: 150, height: 14, borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
        {entries.map(([t, v]) => (
          <span key={t} title={`${t} ${Math.round(v * 100)}%`} style={{ width: `${v * 100}%`, background: TC[t] || '#888' }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{entries.slice(0, 3).map(([t, v]) => `${t} ${Math.round(v * 100)}%`).join(' · ')}</span>
    </div>
  );
}

export function SegmentProfileTable({ profiles }: { profiles: SegmentProfile[] }) {
  if (!profiles.length) return <div style={{ color: '#9ca3af', fontSize: 13, padding: 12 }}>데이터 없음 — 상단 &ldquo;갱신&rdquo;을 눌러 계산하세요.</div>;
  return (
    <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e7e3df', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
        <thead>
          <tr style={{ background: '#faf8f6', color: '#6b7280', fontSize: 11, textAlign: 'left' }}>
            <th style={th}>세그먼트</th><th style={{ ...th, textAlign: 'right' }}>주력가(중앙값)</th><th style={th}>타입 분포</th><th style={th}>주력 국가</th><th style={th}>인기 품목(거래처수)</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.segment_type + p.segment_key} style={{ borderTop: '1px solid #eee' }}>
              <td style={td}><b>{p.label}</b><br /><span style={mut}>{p.client_count}곳 · {p.bottle_count.toLocaleString()}병</span></td>
              <td style={{ ...td, textAlign: 'right' }}><b>{won(p.price_median)}</b><br /><span style={mut}>{won(p.price_p25)}~{won(p.price_p75)}</span></td>
              <td style={td}><TypeBar dist={p.type_dist} /></td>
              <td style={{ ...td, ...mut }}>{p.top_countries.slice(0, 3).map((c) => `${c.country} ${Math.round(c.share * 100)}%`).join(' · ')}</td>
              <td style={{ ...td, ...mut }}>{p.top_items.slice(0, 4).map((i) => `${(i.name || '').slice(0, 16)}(${i.breadth})`).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };
const mut: React.CSSProperties = { color: '#9ca3af', fontSize: 11 };
