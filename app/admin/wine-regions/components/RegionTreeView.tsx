'use client';

import type { RegionTree, WineRegion, RegionWineCounts } from '../types';
import { getCountryFlag } from '../constants';
import { RegionItem } from './RegionItem';

type Props = {
  tree: RegionTree;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  hideCountryLevel: boolean;
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
  wineCounts?: RegionWineCounts | null;
  onShowWines?: (key: string, label: string) => void;
};

/** 우리 와인 수 배지 (0이면 표시 안 함). 클릭 시 해당 산지 와인 목록. */
function WineBadge({ n, onClick }: { n?: number; onClick?: () => void }) {
  if (!n) return null;
  return (
    <span
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title="클릭: 이 산지의 우리 와인 목록"
      style={{
        fontSize: 11, fontWeight: 700, color: '#fff', background: '#7C3AED',
        borderRadius: 10, padding: '1px 8px', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      🍷 {n}종
    </span>
  );
}

export function RegionTreeView({ tree, expanded, onToggle, hideCountryLevel, onEdit, onDelete, wineCounts, onShowWines }: Props) {
  return (
    <div>
      {Array.from(tree.entries()).map(([country, majorMap]) => (
        <CountryNode
          key={country}
          country={country}
          majorMap={majorMap}
          expanded={expanded}
          onToggle={onToggle}
          hideCountryLevel={hideCountryLevel}
          onEdit={onEdit}
          onDelete={onDelete}
          wineCounts={wineCounts}
          onShowWines={onShowWines}
        />
      ))}
    </div>
  );
}

function CountryNode({
  country, majorMap, expanded, onToggle, hideCountryLevel, onEdit, onDelete, wineCounts,
}: {
  country: string;
  majorMap: Map<string, Map<string, WineRegion[]>>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  hideCountryLevel: boolean;
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
  wineCounts?: RegionWineCounts | null;
  onShowWines?: (key: string, label: string) => void;
}) {
  const showCountryLevel = !hideCountryLevel;
  const isCountryOpen = !showCountryLevel || expanded.has(country);
  const countryCount = Array.from(majorMap.values()).reduce(
    (sum, subMap) => sum + Array.from(subMap.values()).reduce((s, items) => s + items.length, 0), 0,
  );

  const majorContent = Array.from(majorMap.entries()).map(([major, subMap]) => (
    <MajorNode
      key={`${country}>${major}`}
      countryKey={country}
      major={major}
      subMap={subMap}
      showCountryLevel={showCountryLevel}
      expanded={expanded}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
      wineCounts={wineCounts}
      onShowWines={onShowWines}
    />
  ));

  if (!showCountryLevel) return <>{majorContent}</>;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => onToggle(country)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          background: isCountryOpen ? 'var(--text-primary)' : 'var(--action-muted)',
          color: isCountryOpen ? '#fff' : 'var(--text-primary)',
          borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15,
          transition: 'all 0.15s',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: isCountryOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s', fontSize: 12,
        }}>
          ▶
        </span>
        <span>{getCountryFlag(country)}</span>
        <span style={{ flex: 1 }}>{country}</span>
        <WineBadge n={wineCounts?.byCountry?.[country]} onClick={onShowWines ? () => onShowWines(country, country) : undefined} />
        <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{countryCount}</span>
      </div>
      {isCountryOpen && <div style={{ marginTop: 4 }}>{majorContent}</div>}
    </div>
  );
}

function MajorNode({
  countryKey, major, subMap, showCountryLevel, expanded, onToggle, onEdit, onDelete, wineCounts,
}: {
  countryKey: string;
  major: string;
  subMap: Map<string, WineRegion[]>;
  showCountryLevel: boolean;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
  wineCounts?: RegionWineCounts | null;
  onShowWines?: (key: string, label: string) => void;
}) {
  const majorKey = `${countryKey}>${major}`;
  const isMajorOpen = expanded.has(majorKey);
  const majorCount = Array.from(subMap.values()).reduce((s, items) => s + items.length, 0);

  return (
    <div style={{ marginBottom: 4, marginLeft: showCountryLevel ? 16 : 0 }}>
      <div
        onClick={() => onToggle(majorKey)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: isMajorOpen ? 'var(--action)' : '#F5F4F2',
          color: isMajorOpen ? '#fff' : 'var(--text-primary)',
          borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          transition: 'all 0.15s',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: isMajorOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s', fontSize: 12,
        }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>{major}</span>
        <WineBadge n={wineCounts?.byMajor?.[majorKey]} onClick={onShowWines ? () => onShowWines(majorKey, major) : undefined} />
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{majorCount}</span>
      </div>
      {isMajorOpen && Array.from(subMap.entries()).map(([sub, items]) => (
        <SubNode
          key={`${majorKey}>${sub}`}
          majorKey={majorKey}
          sub={sub}
          items={items}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          wineCounts={wineCounts}
          onShowWines={onShowWines}
        />
      ))}
    </div>
  );
}

function SubNode({
  majorKey, sub, items, expanded, onToggle, onEdit, onDelete, wineCounts,
}: {
  majorKey: string;
  sub: string;
  items: WineRegion[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
  wineCounts?: RegionWineCounts | null;
  onShowWines?: (key: string, label: string) => void;
}) {
  const subKey = `${majorKey}>${sub}`;
  const isSubOpen = expanded.has(subKey);

  return (
    <div style={{ marginLeft: 16, marginTop: 2 }}>
      <div
        onClick={() => onToggle(subKey)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px',
          background: isSubOpen ? '#F8F0F0' : 'var(--gray-50)',
          borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 13, color: 'var(--neutral-600)',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: isSubOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s', fontSize: 10, color: 'var(--text-muted)',
        }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>{sub}</span>
        <WineBadge n={wineCounts?.bySub?.[subKey]} onClick={onShowWines ? () => onShowWines(subKey, sub) : undefined} />
        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{items.length}</span>
      </div>
      {isSubOpen && (
        <div style={{ marginLeft: 20, padding: '4px 0' }}>
          {items.map(r => <RegionItem key={r.id} region={r} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}
