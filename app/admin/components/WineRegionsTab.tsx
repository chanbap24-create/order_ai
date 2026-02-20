'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

interface WineRegion {
  id: number;
  country: string;
  major_region: string;
  sub_region: string | null;
  appellation: string | null;
  cru_vineyard: string | null;
  classification: string | null;
  grape_varieties: string | null;
  notes: string | null;
}

const COUNTRIES = [
  { value: '', label: '전체', flag: '' },
  { value: '프랑스 France', label: '프랑스', flag: '🇫🇷' },
  { value: '이탈리아 Italy', label: '이탈리아', flag: '🇮🇹' },
  { value: '스페인 Spain', label: '스페인', flag: '🇪🇸' },
  { value: '미국 USA', label: '미국', flag: '🇺🇸' },
  { value: '호주 Australia', label: '호주', flag: '🇦🇺' },
  { value: '포르투갈 Portugal', label: '포르투갈', flag: '🇵🇹' },
  { value: '아르헨티나 Argentina', label: '아르헨티나', flag: '🇦🇷' },
  { value: '뉴질랜드 New Zealand', label: '뉴질랜드', flag: '🇳🇿' },
  { value: '칠레 Chile', label: '칠레', flag: '🇨🇱' },
];

const EMPTY: WineRegion = {
  id: 0,
  country: '프랑스 France',
  major_region: '',
  sub_region: '',
  appellation: '',
  cru_vineyard: '',
  classification: '',
  grape_varieties: '',
  notes: '',
};

export default function WineRegionsTab() {
  const [regions, setRegions] = useState<WineRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<WineRegion | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wine-regions');
      const data = await res.json();
      if (Array.isArray(data)) setRegions(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const filtered = useMemo(() => {
    let list = regions;
    if (selectedCountry) {
      list = list.filter(r => r.country === selectedCountry);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.country || '').toLowerCase().includes(q) ||
        (r.major_region || '').toLowerCase().includes(q) ||
        (r.sub_region || '').toLowerCase().includes(q) ||
        (r.appellation || '').toLowerCase().includes(q) ||
        (r.cru_vineyard || '').toLowerCase().includes(q) ||
        (r.classification || '').toLowerCase().includes(q) ||
        (r.grape_varieties || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [regions, search, selectedCountry]);

  // 국가별 건수 (필터 전 전체 데이터 기준)
  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    regions.forEach(r => {
      map[r.country] = (map[r.country] || 0) + 1;
    });
    return map;
  }, [regions]);

  // 국가 > 대지역 > 서브리전 3단계 트리
  const tree = useMemo(() => {
    const countryMap = new Map<string, Map<string, Map<string, WineRegion[]>>>();
    for (const r of filtered) {
      const country = r.country || '(미지정)';
      const major = r.major_region || '(미지정)';
      const sub = r.sub_region || '(직접)';
      if (!countryMap.has(country)) countryMap.set(country, new Map());
      const majorMap = countryMap.get(country)!;
      if (!majorMap.has(major)) majorMap.set(major, new Map());
      const subMap = majorMap.get(major)!;
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub)!.push(r);
    }
    return countryMap;
  }, [filtered]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    tree.forEach((majorMap, country) => {
      keys.add(country);
      majorMap.forEach((subMap, major) => {
        const majorKey = `${country}>${major}`;
        keys.add(majorKey);
        subMap.forEach((_, sub) => {
          keys.add(`${majorKey}>${sub}`);
        });
      });
    });
    setExpanded(keys);
  };

  const collapseAll = () => setExpanded(new Set());

  const handleSave = async () => {
    if (!editItem) return;
    if (!editItem.country.trim()) { showToast('국가는 필수입니다'); return; }
    if (!editItem.major_region.trim()) { showToast('대지역은 필수입니다'); return; }
    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const body = isNew ? { ...editItem, id: undefined } : editItem;
      const res = await fetch('/api/wine-regions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast(isNew ? '추가 완료' : '수정 완료');
        setEditItem(null);
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || '저장 실패');
      }
    } catch { showToast('저장 실패'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/wine-regions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('삭제 완료');
        fetchData();
      }
    } catch { showToast('삭제 실패'); }
  };

  const classColor = (cls: string | null) => {
    if (!cls) return '#a8a098';
    const c = cls.toLowerCase();
    if (c.includes('grand cru') && !c.includes('classé')) return '#8B1538';
    if (c.includes('1er') || c.includes('premier')) return '#B8860B';
    if (c.includes('classé') || c.includes('docg') || c.includes('doca')) return '#5A1515';
    if (c.includes('village') || c.includes('doc') || c === 'doc') return '#2E7D32';
    if (c.includes('mga') || c.includes('cru')) return '#6B4E2F';
    if (c.includes('bourgeois')) return '#795548';
    return '#555';
  };

  const getCountryFlag = (country: string) => {
    const found = COUNTRIES.find(c => c.value === country);
    return found?.flag || '';
  };

  const renderItem = (r: WineRegion) => (
    <div key={r.id} style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {r.appellation && <span style={{ fontWeight: 600, color: '#2c1810' }}>{r.appellation}</span>}
          {r.cru_vineyard && <span style={{ color: '#8B1538', fontWeight: 500 }}>{r.cru_vineyard}</span>}
          {r.classification && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
              background: classColor(r.classification) + '15', color: classColor(r.classification),
              whiteSpace: 'nowrap',
            }}>{r.classification}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 12, color: '#8a8580' }}>
          {r.grape_varieties && <span>{r.grape_varieties}</span>}
          {r.notes && <span style={{ color: '#B8860B' }}>{r.notes}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => { setEditItem({ ...r }); setIsNew(false); }}
          style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#555' }}>
          수정
        </button>
        <button onClick={() => handleDelete(r.id)}
          style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #fcc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#c44' }}>
          삭제
        </button>
      </div>
    </div>
  );

  const renderTree = () => {
    // 국가가 선택되어 있으면 국가 레벨 건너뛰기
    const showCountryLevel = !selectedCountry;

    return (
      <div>
        {Array.from(tree.entries()).map(([country, majorMap]) => {
          const countryKey = country;
          const isCountryOpen = !showCountryLevel || expanded.has(countryKey);
          const countryCount = Array.from(majorMap.values()).reduce(
            (sum, subMap) => sum + Array.from(subMap.values()).reduce((s, items) => s + items.length, 0), 0
          );

          const majorContent = Array.from(majorMap.entries()).map(([major, subMap]) => {
            const majorKey = `${countryKey}>${major}`;
            const isMajorOpen = expanded.has(majorKey);
            const majorCount = Array.from(subMap.values()).reduce((s, items) => s + items.length, 0);

            return (
              <div key={majorKey} style={{ marginBottom: 4, marginLeft: showCountryLevel ? 16 : 0 }}>
                <div onClick={() => toggleExpand(majorKey)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: isMajorOpen ? '#5A1515' : '#F5F4F2',
                    color: isMajorOpen ? '#fff' : '#2c1810',
                    borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                    transition: 'all 0.15s',
                  }}>
                  <span style={{
                    display: 'inline-block',
                    transform: isMajorOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s', fontSize: 12,
                  }}>▶</span>
                  <span style={{ flex: 1 }}>{major}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{majorCount}</span>
                </div>
                {isMajorOpen && Array.from(subMap.entries()).map(([sub, items]) => {
                  const subKey = `${majorKey}>${sub}`;
                  const isSubOpen = expanded.has(subKey);
                  return (
                    <div key={subKey} style={{ marginLeft: 16, marginTop: 2 }}>
                      <div onClick={() => toggleExpand(subKey)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px',
                          background: isSubOpen ? '#F8F0F0' : '#FAFAFA',
                          borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 13, color: '#444',
                        }}>
                        <span style={{
                          display: 'inline-block',
                          transform: isSubOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s', fontSize: 10, color: '#a8a098',
                        }}>▶</span>
                        <span style={{ flex: 1 }}>{sub}</span>
                        <span style={{ fontSize: 11, color: '#aaa' }}>{items.length}</span>
                      </div>
                      {isSubOpen && (
                        <div style={{ marginLeft: 20, padding: '4px 0' }}>
                          {items.map(renderItem)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          });

          if (!showCountryLevel) return <div key={countryKey}>{majorContent}</div>;

          return (
            <div key={countryKey} style={{ marginBottom: 8 }}>
              <div onClick={() => toggleExpand(countryKey)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: isCountryOpen ? '#2c1810' : 'rgba(90,21,21,0.06)',
                  color: isCountryOpen ? '#fff' : '#2c1810',
                  borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15,
                  transition: 'all 0.15s',
                }}>
                <span style={{
                  display: 'inline-block',
                  transform: isCountryOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s', fontSize: 12,
                }}>▶</span>
                <span>{getCountryFlag(country)}</span>
                <span style={{ flex: 1 }}>{country}</span>
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{countryCount}</span>
              </div>
              {isCountryOpen && <div style={{ marginTop: 4 }}>{majorContent}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F5F4F2' }}>
            {['국가', '대지역', '서브리전', 'AOC/DO/AVA', '크뤼/포도밭', '등급', '품종', '비고', ''].map(h => (
              <th key={h} style={{
                padding: '8px 6px', textAlign: 'left', fontWeight: 600,
                color: '#555', borderBottom: '2px solid #E5E5E5', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                <span style={{ marginRight: 4 }}>{getCountryFlag(r.country)}</span>
                <span style={{ fontSize: 11, color: '#8a8580' }}>{r.country?.split(' ')[0]}</span>
              </td>
              <td style={{ padding: '6px', fontWeight: 500, color: '#5A1515' }}>{r.major_region}</td>
              <td style={{ padding: '6px', color: '#444' }}>{r.sub_region || '-'}</td>
              <td style={{ padding: '6px', fontWeight: 500 }}>{r.appellation || '-'}</td>
              <td style={{ padding: '6px', color: '#8B1538' }}>{r.cru_vineyard || '-'}</td>
              <td style={{ padding: '6px' }}>
                {r.classification ? (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                    background: classColor(r.classification) + '15', color: classColor(r.classification),
                  }}>{r.classification}</span>
                ) : '-'}
              </td>
              <td style={{ padding: '6px', color: '#8a8580', fontSize: 11 }}>{r.grape_varieties || '-'}</td>
              <td style={{ padding: '6px', color: '#B8860B', fontSize: 11 }}>{r.notes || '-'}</td>
              <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                <button onClick={() => { setEditItem({ ...r }); setIsNew(false); }}
                  style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #ddd', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#555', marginRight: 4 }}>
                  수정
                </button>
                <button onClick={() => handleDelete(r.id)}
                  style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #fcc', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#c44' }}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderEditModal = () => {
    if (!editItem) return null;
    const fields: { key: keyof WineRegion; label: string; required?: boolean; type?: string }[] = [
      { key: 'country', label: '국가', required: true, type: 'select' },
      { key: 'major_region', label: '대지역', required: true },
      { key: 'sub_region', label: '서브리전' },
      { key: 'appellation', label: 'AOC/DO/AVA' },
      { key: 'cru_vineyard', label: '크뤼/포도밭' },
      { key: 'classification', label: '등급' },
      { key: 'grape_varieties', label: '주요 품종' },
      { key: 'notes', label: '비고' },
    ];
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(90,21,21,0.4)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }} onClick={() => setEditItem(null)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: 10, padding: 24,
          width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(90,21,21,0.15)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#2c1810' }}>
            {isNew ? '새 산지 추가' : '산지 수정'}
          </h3>
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a8580', marginBottom: 4 }}>
                {f.label} {f.required && <span style={{ color: '#c44' }}>*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  value={String(editItem[f.key] || '')}
                  onChange={e => setEditItem({ ...editItem, [f.key]: e.target.value } as WineRegion)}
                  style={{
                    width: '100%', height: 36, padding: '0 10px', fontSize: 14,
                    border: '1px solid #E5E5E5', borderRadius: 6, boxSizing: 'border-box',
                    outline: 'none', background: '#fff',
                  }}>
                  {COUNTRIES.filter(c => c.value).map(c => (
                    <option key={c.value} value={c.value}>{c.flag} {c.label} ({c.value})</option>
                  ))}
                </select>
              ) : (
                <input
                  value={String(editItem[f.key] || '')}
                  onChange={e => setEditItem({ ...editItem, [f.key]: e.target.value || null } as WineRegion)}
                  style={{
                    width: '100%', height: 36, padding: '0 10px', fontSize: 14,
                    border: '1px solid #E5E5E5', borderRadius: 6, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditItem(null)}
              style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#8a8580' }}>
              취소
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{
                padding: '8px 20px', fontSize: 13, border: 'none', borderRadius: 6,
                background: '#5A1515', color: '#fff', cursor: saving ? 'default' : 'pointer',
                fontWeight: 600, opacity: saving ? 0.6 : 1,
              }}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#a8a098' }}>데이터 로딩 중...</div>;
  }

  return (
    <div>
      {/* 국가 필터 칩 */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {COUNTRIES.map(c => {
          const isActive = selectedCountry === c.value;
          const cnt = c.value ? (countryCounts[c.value] || 0) : regions.length;
          return (
            <button key={c.value} onClick={() => { setSelectedCountry(c.value); setExpanded(new Set()); }}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: isActive ? '#5A1515' : 'rgba(90,21,21,0.05)',
                color: isActive ? '#fff' : '#8a8580',
              }}>
              {c.flag && <span style={{ marginRight: 4 }}>{c.flag}</span>}
              {c.label}
              <span style={{
                marginLeft: 4, fontSize: 10, opacity: 0.7,
              }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Header + Stats */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontSize: 13, color: '#8a8580' }}>
          전체 <strong style={{ color: '#2c1810' }}>{regions.length}</strong>개 산지
          {search && ` / 검색결과 ${filtered.length}개`}
        </div>
        <button onClick={() => { setEditItem({ ...EMPTY, country: selectedCountry || '프랑스 France' }); setIsNew(true); }}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none',
            borderRadius: 6, background: '#5A1515', color: '#fff', cursor: 'pointer',
          }}>
          + 새 산지 추가
        </button>
      </div>

      {/* Search + View Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="국가, 지역, AOC, 품종, 등급 검색..."
            style={{
              width: '100%', height: 38, padding: '0 12px 0 36px', fontSize: 14,
              border: '1px solid #E5E5E5', borderRadius: 8, boxSizing: 'border-box', outline: 'none', background: '#fff',
            }}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          {search && (
            <button onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 8, top: 8,
                background: 'none', border: 'none', cursor: 'pointer', color: '#a8a098', fontSize: 16, lineHeight: 1,
              }}>x</button>
          )}
        </div>
        <div style={{ display: 'flex', background: 'rgba(90,21,21,0.05)', borderRadius: 6, padding: 2 }}>
          {(['tree', 'table'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer',
                background: viewMode === mode ? '#fff' : 'transparent',
                color: viewMode === mode ? '#5A1515' : '#a8a098',
                boxShadow: viewMode === mode ? '0 1px 3px rgba(90,21,21,0.08)' : 'none',
              }}>
              {mode === 'tree' ? '트리' : '테이블'}
            </button>
          ))}
        </div>
      </div>

      {/* Tree controls */}
      {viewMode === 'tree' && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <button onClick={expandAll} style={{
            padding: '3px 10px', fontSize: 11, border: '1px solid #ddd',
            borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#8a8580',
          }}>모두 펼치기</button>
          <button onClick={collapseAll} style={{
            padding: '3px 10px', fontSize: 11, border: '1px solid #ddd',
            borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#8a8580',
          }}>모두 접기</button>
        </div>
      )}

      {/* Content */}
      <div style={{
        background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #E5E5E5',
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#a8a098' }}>
            {search ? '검색 결과가 없습니다' : '데이터가 없습니다'}
          </div>
        ) : viewMode === 'tree' ? renderTree() : renderTable()}
      </div>

      {/* Edit Modal */}
      {renderEditModal()}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#2c1810', color: '#fff', padding: '8px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 10000, boxShadow: '0 4px 12px rgba(90,21,21,0.15)',
        }}>{toast}</div>
      )}
    </div>
  );
}
