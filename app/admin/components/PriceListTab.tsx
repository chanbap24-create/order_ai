'use client';

import { useEffect, useState } from 'react';
import Card from '@/app/components/ui/Card';
import type { Wine, PriceHistoryEntry } from '@/app/types/wine';

export default function PriceListTab() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/price-list')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setWines(data.data.wines || []);
          setPriceChanges(data.data.priceChanges || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const changedCodes = new Set(priceChanges.map((p) => p.item_code));

  const filtered = wines.filter((w) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (w.item_name_kr?.toLowerCase().includes(term) || w.item_name_en?.toLowerCase().includes(term) || w.item_code.toLowerCase().includes(term) || w.country?.toLowerCase().includes(term));
  });

  const handleDownload = async (version: 'highlight' | 'clean') => {
    try {
      const res = await fetch(`/api/admin/price-list/export?version=${version}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `price-list-${version}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <input className="input" style={{ width: 300, padding: 'var(--space-2) var(--space-3)' }} placeholder="와인명/품번/국가 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-primary btn-sm" onClick={() => handleDownload('highlight')}>
            Excel (하이라이트)
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => handleDownload('clean')}>
            Excel (클린)
          </button>
        </div>
      </div>

      {/* 가격 변동 알림 */}
      {priceChanges.length > 0 && (
        <Card size="sm" style={{ marginBottom: 'var(--space-4)', background: '#FFF8E1', border: '1px solid #FFE082' }}>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: '#7C6800' }}>
            최근 가격 변동 ({priceChanges.length}건)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: 150, overflowY: 'auto' }}>
            {priceChanges.slice(0, 20).map((p) => (
              <div key={p.id} style={{ fontSize: 'var(--text-xs)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <code>{p.item_code}</code>
                <span>{p.old_value?.toLocaleString()} → {p.new_value?.toLocaleString()}</span>
                <span style={{ color: (p.change_pct ?? 0) > 0 ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 600 }}>
                  {(p.change_pct ?? 0) > 0 ? '+' : ''}{p.change_pct?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 가격 테이블 */}
      <Card style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-light)' }}>로딩 중...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>품번</th>
                <th style={thStyle}>품명</th>
                <th style={thStyle}>국가</th>
                <th style={thStyle}>공급처</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>공급가</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>재고</th>
                <th style={thStyle}>상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const hasChange = changedCodes.has(w.item_code);
                const change = priceChanges.find((p) => p.item_code === w.item_code);
                return (
                  <tr key={w.item_code} style={{
                    borderBottom: '1px solid var(--color-border-light)',
                    background: w.status === 'new' ? 'rgba(255,149,0,0.06)' : hasChange ? 'rgba(139,21,56,0.04)' : undefined,
                  }}>
                    <td style={tdStyle}><code style={{ fontSize: 'var(--text-xs)' }}>{w.item_code}</code></td>
                    <td style={tdStyle}>
                      {w.item_name_kr}
                      {w.status === 'new' && <span style={{ marginLeft: 6, background: '#FF9500', color: 'white', fontSize: '10px', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>NEW</span>}
                    </td>
                    <td style={tdStyle}>{w.country_en || w.country || '-'}</td>
                    <td style={tdStyle}>{w.supplier || w.supplier_kr || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {w.supply_price != null ? w.supply_price.toLocaleString() : '-'}
                      {change && (
                        <span style={{ fontSize: 'var(--text-xs)', marginLeft: 4, color: (change.change_pct ?? 0) > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                          ({(change.change_pct ?? 0) > 0 ? '+' : ''}{change.change_pct?.toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{w.available_stock != null ? w.available_stock : '-'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: w.status === 'new' ? 'var(--color-warning)' : w.status === 'active' ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {w.status === 'new' ? 'NEW' : w.status === 'active' ? '활성' : '단종'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-3) var(--space-2)', fontWeight: 600, color: 'var(--color-text-light)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-2)', verticalAlign: 'middle' };
