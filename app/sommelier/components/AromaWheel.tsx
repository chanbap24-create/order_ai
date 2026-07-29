'use client';

// 아로마 휠 — 안쪽 링: 향미 9계열(고정), 바깥 링: 선택한 계열의 세부 향미(원 전체에 전개).
// 바깥 조각을 탭하면 선택(와인 스테인으로 물듦). 중앙엔 선택 수.
import { FLAVOR_GROUPS } from '../lib/quiz';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';

// 휠용 짧은 계열명 + 계열 고유색(뮤트 팔레트)
const GROUP_META: Record<string, { short: string; color: string }> = {
  fresh_fruit: { short: '상큼과일', color: '#b3a04d' },
  sweet_fruit: { short: '달콤과일', color: '#cf9a58' },
  red_fruit: { short: '붉은과일', color: '#b0475a' },
  black_fruit: { short: '검은과일', color: '#5f3a55' },
  floral_herb: { short: '꽃·허브', color: '#7c8b60' },
  oak_spice: { short: '오크·향신', color: '#9a6b42' },
  earthy: { short: '흙·숙성', color: '#6f5847' },
  mineral: { short: '미네랄', color: '#7d858c' },
  creamy: { short: '크림·빵', color: '#c2a878' },
};

const TAU = Math.PI * 2;
const polar = (cx: number, cy: number, r: number, a: number) =>
  [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)] as const;

/** 도넛 조각 path (a0→a1, 반지름 r0~r1) */
function seg(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

export function AromaWheel({ selected, selectedGroups, activeGroup, onGroup, onFlavor }: {
  selected: string[];
  selectedGroups: string[];   // 계열 통째 선택(세부 없이 계열만 골라도 됨)
  activeGroup: string | null;
  onGroup: (g: string) => void;
  onFlavor: (key: string) => void;
}) {
  const C = 190, R_IN0 = 64, R_IN1 = 116, R_OUT0 = 120, R_OUT1 = 182;
  const groups = Object.keys(FLAVOR_GROUPS);
  const gAngle = TAU / groups.length;
  const flavors = activeGroup ? FLAVOR_GROUPS[activeGroup].keys : [];
  const fAngle = flavors.length ? TAU / flavors.length : 0;

  return (
    <svg viewBox="0 0 380 380" className="som-wheel" role="group" aria-label="향미 아로마 휠">
      {/* 바깥 링 — 활성 계열의 세부 향미 */}
      {flavors.map((k, i) => {
        const a0 = i * fAngle + 0.006, a1 = (i + 1) * fAngle - 0.006;
        const mid = (a0 + a1) / 2;
        const [tx, ty] = polar(C, C, (R_OUT0 + R_OUT1) / 2, mid);
        const on = selected.includes(k);
        const gc = GROUP_META[activeGroup!]?.color || '#999';
        return (
          <g key={k} className="som-wseg" onClick={() => onFlavor(k)}>
            <path d={seg(C, C, R_OUT0, R_OUT1, a0, a1)}
              fill={on ? 'var(--som-stain)' : '#fff'}
              stroke={on ? 'var(--som-stain)' : gc} strokeOpacity={on ? 1 : 0.45} strokeWidth="1" />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
              fontSize={(FLAVOR_KO[k] || k).length > 5 ? 9.5 : 11.5} fontWeight={600}
              fill={on ? '#fff' : 'var(--som-ink)'} fillOpacity={on ? 1 : 0.75}>
              {FLAVOR_KO[k] || k}
            </text>
          </g>
        );
      })}
      {/* 안쪽 링 — 9계열 */}
      {groups.map((g, i) => {
        const a0 = i * gAngle + 0.008, a1 = (i + 1) * gAngle - 0.008;
        const mid = (a0 + a1) / 2;
        const [tx, ty] = polar(C, C, (R_IN0 + R_IN1) / 2, mid);
        const meta = GROUP_META[g];
        const active = activeGroup === g;
        const picked = selectedGroups.includes(g);
        const cnt = FLAVOR_GROUPS[g].keys.filter((k) => selected.includes(k)).length;
        const sub = picked ? '✓' : cnt > 0 ? String(cnt) : '';
        return (
          <g key={g} className="som-wseg" onClick={() => onGroup(g)}>
            <path d={seg(C, C, R_IN0, R_IN1, a0, a1)}
              fill={meta.color} fillOpacity={picked ? 0.9 : active ? 0.75 : cnt ? 0.5 : 0.22}
              stroke="#fff" strokeWidth="1.5" />
            <text x={tx} y={sub ? ty - 6 : ty} textAnchor="middle" dominantBaseline="central"
              fontSize="11" fontWeight={700}
              fill={picked || active ? '#fff' : 'var(--som-ink)'} fillOpacity={picked || active ? 1 : 0.8}>
              {meta.short}
            </text>
            {sub && (
              <text x={tx} y={ty + 9} textAnchor="middle" dominantBaseline="central"
                fontSize="10" fontWeight={700} fill={picked || active ? '#fff' : 'var(--som-stain)'}>
                {sub}
              </text>
            )}
          </g>
        );
      })}
      {/* 중앙 */}
      <circle cx={C} cy={C} r={R_IN0 - 8} fill="#fff" stroke="rgba(184,154,106,.4)" strokeWidth="1" />
      <text x={C} y={selectedGroups.length + selected.length ? C - 8 : C} textAnchor="middle" dominantBaseline="central"
        fontSize="12" fill="var(--som-muted)">
        {activeGroup ? GROUP_META[activeGroup].short : '계열을 골라주세요'}
      </text>
      {selectedGroups.length + selected.length > 0 && (
        <text x={C} y={C + 12} textAnchor="middle" dominantBaseline="central"
          fontSize="15" fontWeight={700} fill="var(--som-stain)">
          {selectedGroups.length + selected.length}
        </text>
      )}
    </svg>
  );
}
