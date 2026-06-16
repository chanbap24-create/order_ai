'use client';

import { useEffect, useState } from 'react';
import type { ViewMode, WineRegion, RegionWineCounts } from '../wine-regions/types';
import { EMPTY_REGION } from '../wine-regions/constants';
import { useToast } from '../wine-regions/hooks/useToast';
import { useRegions } from '../wine-regions/hooks/useRegions';
import { useRegionFilter } from '../wine-regions/hooks/useRegionFilter';
import { CountryChips } from '../wine-regions/components/CountryChips';
import { SearchBar } from '../wine-regions/components/SearchBar';
import { RegionTreeView } from '../wine-regions/components/RegionTreeView';
import { RegionTableView } from '../wine-regions/components/RegionTableView';
import { RegionEditModal } from '../wine-regions/components/RegionEditModal';

export default function WineRegionsTab() {
  const { toast, show: showToast } = useToast();
  const { regions, loading, saving, save, remove } = useRegions(showToast);
  const f = useRegionFilter(regions);

  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [editItem, setEditItem] = useState<WineRegion | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [wineCounts, setWineCounts] = useState<RegionWineCounts | null>(null);

  useEffect(() => {
    fetch('/api/admin/wine-regions/wine-counts')
      .then((r) => r.json())
      .then((d) => { if (d.success) setWineCounts(d); })
      .catch(() => {});
  }, []);

  const handleEdit = (r: WineRegion) => {
    setEditItem({ ...r });
    setIsNew(false);
  };

  const handleNew = () => {
    setEditItem({ ...EMPTY_REGION, country: f.selectedCountry || '프랑스 France' });
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editItem) return;
    const ok = await save(editItem, isNew);
    if (ok) setEditItem(null);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>데이터 로딩 중...</div>;
  }

  return (
    <div>
      <CountryChips
        selectedCountry={f.selectedCountry}
        countryCounts={f.countryCounts}
        totalRegions={regions.length}
        onSelect={f.selectCountry}
      />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          전체 <strong style={{ color: 'var(--text-primary)' }}>{regions.length}</strong>개 산지
          {f.search && ` / 검색결과 ${f.filtered.length}개`}
          {wineCounts && (
            <span style={{ marginLeft: 10 }}>
              · 우리 와인 <strong style={{ color: '#7C3AED' }}>{wineCounts.matched}</strong>/{wineCounts.total}종 산지매핑
              {wineCounts.unmatched > 0 && (
                <span
                  title={wineCounts.unmatchedSamples.join('\n')}
                  style={{ marginLeft: 6, color: '#dc2626', cursor: 'help' }}
                >
                  · 미분류 {wineCounts.unmatched}종{wineCounts.noRegion > 0 ? ` (산지없음 ${wineCounts.noRegion})` : ''}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          onClick={handleNew}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none',
            borderRadius: 6, background: 'var(--action)', color: '#fff', cursor: 'pointer',
          }}
        >
          + 새 산지 추가
        </button>
      </div>

      <SearchBar
        search={f.search}
        onSearchChange={f.setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'tree' && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={f.expandAll}
            style={{
              padding: '3px 10px', fontSize: 11, border: '1px solid var(--gray-300)',
              borderRadius: 4, background: '#fff', cursor: 'pointer', color: 'var(--text-tertiary)',
            }}
          >
            모두 펼치기
          </button>
          <button
            onClick={f.collapseAll}
            style={{
              padding: '3px 10px', fontSize: 11, border: '1px solid var(--gray-300)',
              borderRadius: 4, background: '#fff', cursor: 'pointer', color: 'var(--text-tertiary)',
            }}
          >
            모두 접기
          </button>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid var(--gray-200)' }}>
        {f.filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {f.search ? '검색 결과가 없습니다' : '데이터가 없습니다'}
          </div>
        ) : viewMode === 'tree' ? (
          <RegionTreeView
            tree={f.tree}
            expanded={f.expanded}
            onToggle={f.toggleExpand}
            hideCountryLevel={!!f.selectedCountry}
            onEdit={handleEdit}
            onDelete={remove}
            wineCounts={wineCounts}
          />
        ) : (
          <RegionTableView regions={f.filtered} onEdit={handleEdit} onDelete={remove} />
        )}
      </div>

      {editItem && (
        <RegionEditModal
          item={editItem}
          isNew={isNew}
          saving={saving}
          onChange={setEditItem}
          onClose={() => setEditItem(null)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text-primary)', color: '#fff', padding: '8px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 10000,
          boxShadow: '0 4px 12px rgba(90,21,21,0.15)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
