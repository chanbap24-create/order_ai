'use client';

import { useState, useEffect, useCallback } from 'react';

interface DismissedItem {
  id: number;
  item_no: string;
  item_name: string;
  country: string;
  wine_type: string;
  supply_price: number;
  current_stock: number;
  dismissed_at: string;
}

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}월 ${day}일`;
}

function formatDateFull(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function DismissedTab() {
  const [items, setItems] = useState<DismissedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const loadDismissed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales/alerts');
      const data = await res.json();
      setItems(data.items || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDismissed(); }, [loadDismissed]);

  // 검색 필터
  const filtered = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.item_name.toLowerCase().includes(q) ||
           item.item_no.toLowerCase().includes(q) ||
           item.country.toLowerCase().includes(q);
  });

  // 체크
  const toggleCheck = (itemNo: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo); else next.add(itemNo);
      return next;
    });
  };

  const allChecked = filtered.length > 0 && filtered.every(i => checked.has(i.item_no));
  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(filtered.map(i => i.item_no)));
    }
  };

  // 복구
  const handleRestore = async () => {
    if (checked.size === 0) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/sales/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_nos: Array.from(checked), action: 'restore' }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.filter(i => !checked.has(i.item_no)));
        setToast(`${checked.size}개 와인이 복구되었습니다.`);
        setChecked(new Set());
        setTimeout(() => setToast(null), 3000);
      }
    } catch { /* ignore */ }
    finally { setRestoring(false); }
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>
            제외된 와인
          </span>
          <span style={{
            fontSize: 12, color: '#999', fontWeight: 500,
          }}>
            {items.length}건
          </span>
        </div>
      </div>

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="와인명, 품번, 국가 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
            border: '1px solid #e0e0e0', fontSize: 16, boxSizing: 'border-box',
            background: '#fafafa', outline: 'none',
          }}
        />
      </div>

      {/* 전체선택 + 복구 */}
      {items.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, padding: '8px 12px', background: '#f8f8f6', borderRadius: 8,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              style={{ width: 16, height: 16, accentColor: '#5A1515' }}
            />
            <span style={{ fontWeight: 500, color: '#333' }}>
              전체 선택 {checked.size > 0 && `(${checked.size}개)`}
            </span>
          </label>

          {checked.size > 0 && (
            <button
              onClick={handleRestore}
              disabled={restoring}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid #2e7d32',
                background: 'white', color: '#2e7d32',
                fontSize: 12, fontWeight: 600,
                cursor: restoring ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: restoring ? 0.5 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              {restoring ? '복구 중...' : `${checked.size}개 복구`}
            </button>
          )}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#999', fontSize: 13 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          <div>제외된 와인이 없습니다.</div>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#999', fontSize: 13 }}>
          검색 결과가 없습니다.
        </div>
      )}

      {/* 리스트 */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <div key={item.item_no} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              border: checked.has(item.item_no) ? '1.5px solid #5A1515' : '1px solid #e8e8e8',
              background: checked.has(item.item_no) ? '#fdf8f8' : 'white',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
              onClick={() => toggleCheck(item.item_no)}
            >
              {/* 체크박스 */}
              <input
                type="checkbox"
                checked={checked.has(item.item_no)}
                onChange={() => toggleCheck(item.item_no)}
                onClick={e => e.stopPropagation()}
                style={{ width: 16, height: 16, accentColor: '#5A1515', flexShrink: 0 }}
              />

              {/* 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#333',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.item_name}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
                  fontSize: 11, color: '#999', flexWrap: 'wrap',
                }}>
                  <span style={{ color: '#bbb' }}>{item.item_no}</span>
                  {item.country && <span>{item.country}</span>}
                  {item.wine_type && (
                    <span style={{
                      padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                      background: item.wine_type === '레드' || item.wine_type === 'red' ? '#ffebee'
                        : item.wine_type === '화이트' || item.wine_type === 'white' ? '#fff8e1'
                        : item.wine_type === '로제' || item.wine_type === 'rosé' ? '#fce4ec'
                        : '#f3e5f5',
                      color: item.wine_type === '레드' || item.wine_type === 'red' ? '#c62828'
                        : item.wine_type === '화이트' || item.wine_type === 'white' ? '#f57f17'
                        : item.wine_type === '로제' || item.wine_type === 'rosé' ? '#ad1457'
                        : '#6a1b9a',
                    }}>
                      {item.wine_type}
                    </span>
                  )}
                  {item.supply_price > 0 && (
                    <span>{fmt(item.supply_price)}</span>
                  )}
                </div>
              </div>

              {/* 우측: 재고 + 제외일 */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: item.current_stock > 0 ? '#2e7d32' : '#dc3545',
                }}>
                  {item.current_stock > 0 ? `${item.current_stock}병` : '품절'}
                </div>
                <div style={{
                  fontSize: 10, color: '#bbb', marginTop: 2,
                }}>
                  {formatDate(item.dismissed_at)} 제외
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#2e7d32', color: 'white', padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
