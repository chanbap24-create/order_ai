'use client';

import { useEffect, useState, useCallback } from 'react';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import type { Wine, WineResearchResult } from '@/app/types/wine';
import WineResearchPanel from './WineResearchPanel';

export default function NewWineTab() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'new' | 'all'>('new');
  const [search, setSearch] = useState('');
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set());

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter === 'new') params.set('status', 'new');
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/admin/wines?${params}`);
      const data = await res.json();
      if (data.success) setWines(data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { fetchWines(); }, [fetchWines]);

  const handleResearch = async (wine: Wine) => {
    setResearchingIds((prev) => new Set(prev).add(wine.item_code));
    try {
      const res = await fetch('/api/admin/wines/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCode: wine.item_code, itemNameKr: wine.item_name_kr }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedWine({ ...wine, ...data.data.wineUpdate });
      }
    } catch { /* ignore */ }
    setResearchingIds((prev) => { const s = new Set(prev); s.delete(wine.item_code); return s; });
  };

  const handleBulkResearch = async () => {
    const newWines = wines.filter((w) => w.status === 'new' && !w.ai_researched);
    for (const wine of newWines.slice(0, 10)) {
      await handleResearch(wine);
    }
    fetchWines();
  };

  const handleSaveResearch = async (itemCode: string, wineData: Partial<Wine>, noteData: Partial<WineResearchResult>) => {
    try {
      await fetch(`/api/admin/wines/${itemCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine: wineData, tastingNote: noteData }),
      });
      setSelectedWine(null);
      fetchWines();
    } catch { /* ignore */ }
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button className={`btn btn-sm ${filter === 'new' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('new')}>
            신규만
          </button>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
            전체
          </button>
          <input
            className="input"
            style={{ width: 220, padding: 'var(--space-2) var(--space-3)' }}
            placeholder="와인명/품번 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleBulkResearch}>
          AI 일괄 조사 (최대 10개)
        </button>
      </div>

      {/* 리서치 패널 */}
      {selectedWine && (
        <WineResearchPanel
          wine={selectedWine}
          onSave={handleSaveResearch}
          onClose={() => setSelectedWine(null)}
        />
      )}

      {/* 와인 테이블 */}
      <Card style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-light)' }}>로딩 중...</div>
        ) : wines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-lighter)' }}>
            {filter === 'new' ? '신규 와인이 없습니다. 와인재고현황을 업로드하세요.' : '와인 데이터가 없습니다.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>품번</th>
                <th style={thStyle}>품명</th>
                <th style={thStyle}>영문명</th>
                <th style={thStyle}>국가</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>공급가</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>재고</th>
                <th style={thStyle}>상태</th>
                <th style={thStyle}>AI</th>
                <th style={thStyle}>작업</th>
              </tr>
            </thead>
            <tbody>
              {wines.map((w) => (
                <tr key={w.item_code} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={tdStyle}><code style={{ fontSize: 'var(--text-xs)' }}>{w.item_code}</code></td>
                  <td style={tdStyle}>{w.item_name_kr}</td>
                  <td style={{ ...tdStyle, color: w.item_name_en ? 'var(--color-text)' : 'var(--color-text-lighter)', fontSize: 'var(--text-xs)' }}>
                    {w.item_name_en || '-'}
                  </td>
                  <td style={tdStyle}>{w.country || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {w.supply_price != null ? w.supply_price.toLocaleString() : '-'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {w.available_stock != null ? w.available_stock : '-'}
                  </td>
                  <td style={tdStyle}>
                    <Badge variant={w.status === 'new' ? 'warning' : w.status === 'active' ? 'success' : 'error'}>
                      {w.status === 'new' ? 'NEW' : w.status === 'active' ? '활성' : '단종'}
                    </Badge>
                  </td>
                  <td style={tdStyle}>
                    {w.ai_researched ? (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>완료</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-lighter)' }}>미완료</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleResearch(w)}
                        disabled={researchingIds.has(w.item_code)}
                      >
                        {researchingIds.has(w.item_code) ? '조사중...' : 'AI 조사'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => setSelectedWine(w)}
                      >
                        편집
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-3) var(--space-2)', fontWeight: 600, color: 'var(--color-text-light)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-2)', verticalAlign: 'middle' };
