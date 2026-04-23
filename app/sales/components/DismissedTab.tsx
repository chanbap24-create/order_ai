'use client';

import { useState } from 'react';
import { useDismissed } from '../dismissed/hooks/useDismissed';
import { DismissedListItem } from '../dismissed/components/DismissedListItem';

export default function DismissedTab() {
  const d = useDismissed();
  const [search, setSearch] = useState('');

  const filtered = d.items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.item_name.toLowerCase().includes(q) ||
           item.item_no.toLowerCase().includes(q) ||
           item.country.toLowerCase().includes(q);
  });

  const allChecked = filtered.length > 0 && filtered.every(i => d.checked.has(i.item_no));

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a8a098" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#2c1810' }}>제외된 와인</span>
          <span style={{ fontSize: 12, color: '#a8a098', fontWeight: 500 }}>{d.items.length}건</span>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#a8a098" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="와인명, 품번, 국가 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
            border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16, boxSizing: 'border-box',
            background: '#faf9f7', outline: 'none',
          }}
        />
      </div>

      {d.items.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, padding: '8px 12px', background: '#faf9f7', borderRadius: 8,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => d.toggleAllFor(filtered)}
              style={{ width: 16, height: 16, accentColor: '#5A1515' }}
            />
            <span style={{ fontWeight: 500, color: '#2c1810' }}>
              전체 선택 {d.checked.size > 0 && `(${d.checked.size}개)`}
            </span>
          </label>
          {d.checked.size > 0 && (
            <button
              onClick={d.handleRestore}
              disabled={d.restoring}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid #2e7d32',
                background: 'white', color: '#2e7d32',
                fontSize: 12, fontWeight: 600,
                cursor: d.restoring ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: d.restoring ? 0.5 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              {d.restoring ? '복구 중...' : `${d.checked.size}개 복구`}
            </button>
          )}
        </div>
      )}

      {d.loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a8a098', fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      {!d.loading && d.items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#a8a098', fontSize: 13 }}>
          <svg
            width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="#a8a098" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginBottom: 12 }}
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          <div>제외된 와인이 없습니다.</div>
        </div>
      )}

      {!d.loading && d.items.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#a8a098', fontSize: 13 }}>
          검색 결과가 없습니다.
        </div>
      )}

      {!d.loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <DismissedListItem
              key={item.item_no}
              item={item}
              isChecked={d.checked.has(item.item_no)}
              onToggle={() => d.toggleCheck(item.item_no)}
            />
          ))}
        </div>
      )}

      {d.toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#2e7d32', color: 'white', padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
        }}>
          {d.toast}
        </div>
      )}
    </div>
  );
}
