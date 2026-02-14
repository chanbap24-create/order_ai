'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Wine } from '@/app/types/wine';

interface WineRow extends Wine {
  tasting_note_id: number | null;
  ai_generated: number;
  approved: number;
}

interface WineRowExt extends WineRow {
  bonded_stock: number | null;
}

export default function AllWinesTab() {
  const [wines, setWines] = useState<WineRowExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countries, setCountries] = useState<{ name: string; cnt: number }[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectedWine, setSelectedWine] = useState<WineRowExt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hideZero, setHideZero] = useState(false);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortBy(''); setSortDir('asc'); } // 3번째 클릭: 정렬 해제
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const sortArrow = (col: string) => {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (search) params.set('search', search);
    if (country) params.set('country', country);
    if (statusFilter) params.set('statusFilter', statusFilter);
    if (sortBy) { params.set('sortBy', sortBy); params.set('sortDir', sortDir); }
    if (hideZero) params.set('hideZero', '1');
    try {
      const res = await fetch(`/api/admin/wines/all?${params}`);
      const data = await res.json();
      if (data.success) {
        setWines(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        if (data.countries) setCountries(data.countries);
      }
    } catch (e) { console.error('[AllWinesTab] fetch error:', e); }
    setLoading(false);
  }, [search, country, statusFilter, page, sortBy, sortDir, hideZero]);

  useEffect(() => { fetchWines(); }, [fetchWines]);

  // 검색 시 페이지 리셋
  useEffect(() => { setPage(1); }, [search, country, statusFilter, hideZero]);

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllChecks = () => {
    if (checkedIds.size === wines.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(wines.map(w => w.item_code)));
    }
  };

  const handleDeleteSingle = async (id: string, name: string) => {
    if (!confirm(`정말 삭제하시겠습니까?\n\n"${name}" (${id})\n\n관련 테이스팅 노트, 이미지도 함께 삭제됩니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/wines/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedWine?.item_code === id) setSelectedWine(null);
        checkedIds.delete(id);
        setCheckedIds(new Set(checkedIds));
        fetchWines();
      } else {
        alert(`삭제 실패: ${data.error}`);
      }
    } catch (e) {
      alert(`삭제 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setDeleting(false);
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) { alert('삭제할 와인을 선택하세요.'); return; }
    if (!confirm(`정말 ${ids.length}개 와인을 삭제하시겠습니까?\n\n관련 테이스팅 노트, 이미지도 함께 삭제됩니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/wines/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: ids }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.deleted}개 삭제 완료`);
        setCheckedIds(new Set());
        if (selectedWine && ids.includes(selectedWine.item_code)) setSelectedWine(null);
        fetchWines();
      } else {
        alert(`삭제 실패: ${data.error}`);
      }
    } catch (e) {
      alert(`삭제 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setDeleting(false);
  };

  const statusLabel = (w: WineRow) => {
    if (w.approved) return { text: '승인', color: '#16a34a', bg: '#dcfce7' };
    if (w.ai_generated) return { text: '조사완료', color: '#ca8a04', bg: '#fef9c3' };
    if (w.status === 'new') return { text: '신규', color: '#2563eb', bg: '#dbeafe' };
    return { text: '기존', color: '#6b7280', bg: '#f3f4f6' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      {/* 상단 컨트롤 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, width: 220 }}
            placeholder="품번/품명/영문명/국가 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff' }}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">전체 국가</option>
            {countries.map(c => (
              <option key={c.name} value={c.name}>{c.name} ({c.cnt})</option>
            ))}
          </select>
          <select
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">전체 상태</option>
            <option value="new">신규</option>
            <option value="active">기존</option>
            <option value="discontinued">단종</option>
          </select>
          <button
            onClick={() => setHideZero(h => !h)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: hideZero ? '1px solid #8B1538' : '1px solid #d1d5db',
              background: hideZero ? '#8B1538' : '#fff',
              color: hideZero ? '#fff' : '#6b7280',
              transition: 'all 0.15s',
            }}
          >
            재고 있는 것만
          </button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>총 {total}개</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleBatchDelete}
            disabled={deleting || checkedIds.size === 0}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
              background: checkedIds.size === 0 ? '#e5e7eb' : '#dc2626', color: '#fff', fontWeight: 600,
              opacity: checkedIds.size === 0 ? 0.5 : 1,
            }}
          >
            {deleting ? '삭제 중...' : `선택 삭제 (${checkedIds.size})`}
          </button>
        </div>
      </div>

      {/* 좌우 분할 */}
      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden' }}>
        {/* 좌측: 와인 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '58px 52px 60px 36px 1fr 70px 50px 50px 36px',
            padding: '10px 12px', borderBottom: '2px solid #e5e7eb', background: '#f9fafb',
            fontSize: 12, fontWeight: 600, color: '#6b7280', position: 'sticky', top: 0, zIndex: 1,
            gap: 6, alignItems: 'center',
          }}>
            {[
              { key: 'item_code', label: '품번' },
              { key: 'country_en', label: '국가' },
              { key: 'region', label: '지역' },
              { key: 'brand', label: '브랜드' },
              { key: 'item_name_kr', label: '한글명' },
              { key: 'supply_price', label: '공급가', right: true },
              { key: 'available_stock', label: '재고', right: true },
              { key: '', label: '보세', right: true },
            ].map(col => (
              <span
                key={col.key || 'bonded'}
                onClick={col.key ? () => handleSort(col.key) : undefined}
                style={{
                  cursor: col.key ? 'pointer' : 'default',
                  textAlign: col.right ? 'right' : 'left',
                  userSelect: 'none',
                  color: sortBy === col.key ? '#8B1538' : '#6b7280',
                }}
              >
                {col.label}{col.key ? sortArrow(col.key) : ''}
              </span>
            ))}
            <span></span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>로딩 중...</div>
          ) : wines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>검색 결과가 없습니다.</div>
          ) : (
            wines.map(w => {
              const sl = statusLabel(w);
              const isSelected = selectedWine?.item_code === w.item_code;
              return (
                <div
                  key={w.item_code}
                  onClick={() => setSelectedWine(w)}
                  style={{
                    display: 'grid', gridTemplateColumns: '58px 52px 60px 36px 1fr 70px 50px 50px 36px',
                    padding: '9px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : '#fff', gap: 6, alignItems: 'center',
                    borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{w.item_code}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.country_en || w.country || '-'}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.region || '-'}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8B1538' }}>{w.brand || '-'}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.item_name_kr}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
                    {w.supply_price != null ? `${w.supply_price.toLocaleString()}` : '-'}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
                    {w.available_stock != null ? w.available_stock.toLocaleString() : '-'}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
                    {w.bonded_stock != null ? w.bonded_stock.toLocaleString() : '-'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSingle(w.item_code, w.item_name_kr); }}
                    disabled={deleting}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, padding: 0 }}
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              );
            })
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12, borderTop: '1px solid #e5e7eb', position: 'sticky', bottom: 0, background: '#fff' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, cursor: page > 1 ? 'pointer' : 'default', background: '#fff', opacity: page <= 1 ? 0.4 : 1 }}
              >
                ◀ 이전
              </button>
              <span style={{ fontSize: 13, color: '#6b7280', lineHeight: '32px' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, cursor: page < totalPages ? 'pointer' : 'default', background: '#fff', opacity: page >= totalPages ? 0.4 : 1 }}
              >
                다음 ▶
              </button>
            </div>
          )}
        </div>

        {/* 우측: 상세 패널 */}
        <div style={{ width: 380, minWidth: 320, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0 }}>
          {!selectedWine ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
              좌측에서 와인을 선택하세요
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
                {selectedWine.item_name_kr}
              </h3>

              {selectedWine.image_url && (
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                  <img src={selectedWine.image_url} alt="" style={{ maxHeight: 180, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <DetailRow label="품번" value={selectedWine.item_code} />
                <DetailRow label="영문명" value={selectedWine.item_name_en || '-'} />
                <DetailRow label="국가" value={selectedWine.country_en || selectedWine.country || '-'} />
                <DetailRow label="산지" value={selectedWine.region || '-'} />
                <DetailRow label="품종" value={selectedWine.grape_varieties || '-'} />
                <DetailRow label="타입" value={selectedWine.wine_type || '-'} />
                <DetailRow label="빈티지" value={selectedWine.vintage || '-'} />
                <DetailRow label="용량" value={selectedWine.volume_ml ? `${selectedWine.volume_ml}ml` : '-'} />
                <DetailRow label="알코올" value={selectedWine.alcohol || '-'} />
                <DetailRow label="공급가" value={selectedWine.supply_price != null ? `₩${selectedWine.supply_price.toLocaleString()}` : '-'} />
                <DetailRow label="재고" value={selectedWine.available_stock != null ? String(selectedWine.available_stock) : '-'} />
                <DetailRow label="공급처" value={selectedWine.supplier_kr || selectedWine.supplier || '-'} />
                <DetailRow label="상태" value={selectedWine.status} />
                <DetailRow label="AI조사" value={selectedWine.ai_researched ? '완료' : '미완료'} />
                <DetailRow label="등록일" value={selectedWine.created_at?.split('T')[0] || '-'} />
                <DetailRow label="수정일" value={selectedWine.updated_at?.split('T')[0] || '-'} />
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => handleDeleteSingle(selectedWine.item_code, selectedWine.item_name_kr)}
                  disabled={deleting}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #dc2626',
                    background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  🗑️ 이 와인 삭제
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: '#9ca3af', minWidth: 60, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1e293b', fontWeight: 500, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
