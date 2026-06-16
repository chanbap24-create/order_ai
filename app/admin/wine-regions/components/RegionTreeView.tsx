'use client';

import type { RegionTree, WineRegion, RegionWineCounts } from '../types';
import { getCountryFlag } from '../constants';
import { RegionItem } from './RegionItem';

type Common = {
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
  wineCounts?: RegionWineCounts | null;
  onShowWines?: (key: string, label: string) => void;
};

type Props = Common & { tree: RegionTree; hideCountryLevel: boolean };

/** 우리 와인 수 배지 (0이면 표시 안 함). onClick 있으면 클릭 시 해당 산지 와인 목록. */
function WineBadge({ n, onClick }: { n?: number; onClick?: () => void }) {
  if (!n) return null;
  return (
    <span
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={onClick ? '클릭: 이 산지의 우리 와인 목록' : undefined}
      style={{
        fontSize: 11, fontWeight: 700, color: '#fff', background: '#7C3AED',
        borderRadius: 10, padding: '1px 8px', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      🍷 {n}종
    </span>
  );
}

const chevron = (open: boolean, size: number) => (
  <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: size }}>▶</span>
);

export function RegionTreeView({ tree, hideCountryLevel, ...c }: Props) {
  return (
    <div>
      {Array.from(tree.entries()).map(([country, superMap]) => (
        <CountryNode key={country} country={country} superMap={superMap} hideCountryLevel={hideCountryLevel} c={c} />
      ))}
    </div>
  );
}

type SuperMap = Map<string, Map<string, Map<string, WineRegion[]>>>;
type MajorMap = Map<string, Map<string, WineRegion[]>>;

function CountryNode({ country, superMap, hideCountryLevel, c }: {
  country: string; superMap: SuperMap; hideCountryLevel: boolean; c: Common;
}) {
  const showCountryLevel = !hideCountryLevel;
  const isOpen = !showCountryLevel || c.expanded.has(country);
  let countryCount = 0;
  superMap.forEach((mm) => mm.forEach((sm) => sm.forEach((items) => { countryCount += items.length; })));

  const content = Array.from(superMap.entries()).map(([sup, majorMap]) => {
    // 단일 district(광역=자기자신)면 광역 래퍼 생략하고 major 를 바로 표시
    const collapse = majorMap.size === 1 && majorMap.has(sup);
    if (collapse) {
      const [major, subMap] = Array.from(majorMap.entries())[0];
      return <MajorNode key={`${country}>${sup}>${major}`} country={country} sup={sup} major={major} subMap={subMap} c={c} />;
    }
    return <SuperNode key={`${country}>${sup}`} country={country} sup={sup} majorMap={majorMap} c={c} />;
  });

  if (!showCountryLevel) return <>{content}</>;

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => c.onToggle(country)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: isOpen ? 'var(--text-primary)' : 'var(--action-muted)',
        color: isOpen ? '#fff' : 'var(--text-primary)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15,
      }}>
        {chevron(isOpen, 12)}
        <span>{getCountryFlag(country)}</span>
        <span style={{ flex: 1 }}>{country}</span>
        <WineBadge n={c.wineCounts?.byCountry?.[country]} onClick={c.onShowWines ? () => c.onShowWines!(country, country) : undefined} />
        <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{countryCount}</span>
      </div>
      {isOpen && <div style={{ marginTop: 4 }}>{content}</div>}
    </div>
  );
}

function SuperNode({ country, sup, majorMap, c }: {
  country: string; sup: string; majorMap: MajorMap; c: Common;
}) {
  const superKey = `${country}>${sup}`;
  const isOpen = c.expanded.has(superKey);
  let regionCount = 0;
  majorMap.forEach((sm) => sm.forEach((items) => { regionCount += items.length; }));
  // 광역 와인 수 = 소속 district(major) 카운트 합
  const wineCount = Array.from(majorMap.keys())
    .reduce((s, m) => s + (c.wineCounts?.byMajor?.[`${country}>${m}`] ?? 0), 0);

  return (
    <div style={{ marginBottom: 4, marginLeft: 16 }}>
      <div onClick={() => c.onToggle(superKey)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: isOpen ? '#6B2D2D' : '#EFE7E7', color: isOpen ? '#fff' : 'var(--text-primary)',
        borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 14,
      }}>
        {chevron(isOpen, 12)}
        <span style={{ flex: 1 }}>{sup}</span>
        <WineBadge n={wineCount || undefined} />
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{regionCount}</span>
      </div>
      {isOpen && (
        <div style={{ marginTop: 2 }}>
          {Array.from(majorMap.entries()).map(([major, subMap]) => (
            <MajorNode key={`${superKey}>${major}`} country={country} sup={sup} major={major} subMap={subMap} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function MajorNode({ country, sup, major, subMap, c }: {
  country: string; sup: string; major: string; subMap: Map<string, WineRegion[]>; c: Common;
}) {
  const expandKey = `${country}>${sup}>${major}`;
  const countKey = `${country}>${major}`; // wineCounts.byMajor 키와 일치
  const isOpen = c.expanded.has(expandKey);
  const regionCount = Array.from(subMap.values()).reduce((s, items) => s + items.length, 0);

  return (
    <div style={{ marginBottom: 4, marginLeft: 16 }}>
      <div onClick={() => c.onToggle(expandKey)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: isOpen ? 'var(--action)' : '#F5F4F2', color: isOpen ? '#fff' : 'var(--text-primary)',
        borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
      }}>
        {chevron(isOpen, 12)}
        <span style={{ flex: 1 }}>{major}</span>
        <WineBadge n={c.wineCounts?.byMajor?.[countKey]} onClick={c.onShowWines ? () => c.onShowWines!(countKey, major) : undefined} />
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{regionCount}</span>
      </div>
      {isOpen && Array.from(subMap.entries()).map(([sub, items]) => (
        <SubNode key={`${expandKey}>${sub}`} country={country} major={major} expandKey={expandKey} sub={sub} items={items} c={c} />
      ))}
    </div>
  );
}

function SubNode({ country, major, expandKey, sub, items, c }: {
  country: string; major: string; expandKey: string; sub: string; items: WineRegion[]; c: Common;
}) {
  const subExpandKey = `${expandKey}>${sub}`;
  const countKey = `${country}>${major}>${sub}`; // wineCounts.bySub 키와 일치
  const isOpen = c.expanded.has(subExpandKey);

  return (
    <div style={{ marginLeft: 16, marginTop: 2 }}>
      <div onClick={() => c.onToggle(subExpandKey)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
        background: isOpen ? '#F8F0F0' : 'var(--gray-50)', borderRadius: 4, cursor: 'pointer',
        fontWeight: 500, fontSize: 13, color: 'var(--neutral-600)',
      }}>
        {chevron(isOpen, 10)}
        <span style={{ flex: 1 }}>{sub}</span>
        <WineBadge n={c.wineCounts?.bySub?.[countKey]} onClick={c.onShowWines ? () => c.onShowWines!(countKey, sub) : undefined} />
        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{items.length}</span>
      </div>
      {isOpen && (
        <div style={{ marginLeft: 20, padding: '4px 0' }}>
          {items.map((r) => <RegionItem key={r.id} region={r} onEdit={c.onEdit} onDelete={c.onDelete} />)}
        </div>
      )}
    </div>
  );
}
