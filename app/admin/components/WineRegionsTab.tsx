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
  const [winesModal, setWinesModal] = useState<{ label: string; wines: string[] } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const loadCounts = () => {
    fetch('/api/admin/wine-regions/wine-counts')
      .then((r) => r.json())
      .then((d) => { if (d.success) setWineCounts(d); })
      .catch(() => {});
  };
  useEffect(() => { loadCounts(); }, []);

  const handleAiClassify = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    showToast('AI가 미분류 산지를 분류 중…');
    try {
      const r = await fetch('/api/admin/wine-regions/ai-classify', { method: 'POST' });
      const d = await r.json();
      if (d.success) {
        showToast(`AI 분류 완료 — ${d.classified ?? 0}개 산지 인식, ${d.addedRows ?? 0}개 추가`);
        loadCounts();
      } else {
        showToast('AI 분류 실패');
      }
    } catch {
      showToast('AI 분류 실패');
    } finally {
      setAiBusy(false);
    }
  };

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
                  onClick={() => setWinesModal({ label: '미분류 와인 (산지 매칭 실패)', wines: wineCounts.unmatchedSamples ?? [] })}
                  title="클릭: 미분류 와인 목록"
                  style={{ marginLeft: 6, color: 'var(--status-danger)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  · 미분류 {wineCounts.unmatched}종{wineCounts.noRegion > 0 ? ` (산지없음 ${wineCounts.noRegion})` : ''}
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {wineCounts && wineCounts.unmatched > wineCounts.noRegion && (
            <button
              onClick={handleAiClassify}
              disabled={aiBusy}
              title="미분류 와인의 산지 문자열을 AI가 읽어 나라/지역으로 자동 분류"
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none',
                borderRadius: 6, background: aiBusy ? 'var(--gray-300)' : '#7C3AED',
                color: '#fff', cursor: aiBusy ? 'default' : 'pointer',
              }}
            >
              {aiBusy ? '분류 중…' : '🤖 AI 미분류 분류'}
            </button>
          )}
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

      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid var(--border-default)' }}>
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
            onShowWines={(key, label) =>
              setWinesModal({ label, wines: wineCounts?.winesByKey?.[key] ?? [] })
            }
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

      {winesModal && (
        <div
          onClick={() => setWinesModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: 20, maxWidth: 520, width: '100%',
              maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                🍷 {winesModal.label} · {winesModal.wines.length}종
              </h3>
              <button onClick={() => setWinesModal(null)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
            {winesModal.wines.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>매핑된 와인이 없습니다.</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.9, color: 'var(--text-primary)' }}>
                {winesModal.wines.map((w, i) => <li key={i}>{w}</li>)}
              </ol>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text-primary)', color: '#fff', padding: '8px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
