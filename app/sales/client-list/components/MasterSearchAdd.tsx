'use client';

import { useEffect, useRef, useState } from 'react';

type Found = { client_code: string; client_name: string };

/**
 * 거래처 마스터 검색 — 기간 목록에 없는(출고 이력 없는) 담당 거래처를 찾아
 * 추천견적 대상으로 추가. 검색어는 상단 검색창을 공유한다.
 */
export function MasterSearchAdd({ query, type, manager, excludeCodes, picked, extraClients, onAdd, onRemove, onOpen }: {
  query: string;
  type: string;                 // wine 전용(추천엔진 CDV)
  manager: string;              // 어드민이면 선택 담당, 일반은 본인(서버에서 강제)
  excludeCodes: Set<string>;    // 이미 기간 목록에 있는 거래처(중복 표시 방지)
  picked: Set<string>;
  extraClients: Map<string, string>; // 검색으로 추가된 거래처(code→name) — 칩 표시
  onAdd: (c: { code: string; name: string }) => void;
  onRemove: (code: string) => void;
  onOpen: (c: { code: string; name: string }) => void; // 행 클릭 → 거래처 상세(등급·정보·추천견적)
}) {
  const [results, setResults] = useState<Found[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    timer.current = setTimeout(async () => {
      if (q.length < 2) { setResults([]); return; }
      try {
        const p = new URLSearchParams({ search: q, type, limit: '8' });
        if (manager) p.set('manager', manager);
        const r = await fetch(`/api/sales/clients?${p}`, { credentials: 'include' });
        const j = await r.json();
        setResults(Array.isArray(j.clients) ? j.clients : []);
      } catch { setResults([]); }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, type, manager]);

  const fresh = results.filter((c) => c.client_code && !excludeCodes.has(c.client_code));
  const showResults = query.trim().length >= 2 && fresh.length > 0;
  if (!showResults && extraClients.size === 0) return null;

  return (
    <>
    {extraClients.size > 0 && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>검색 추가</span>
        {[...extraClients].map(([code, name]) => (
          <span key={code} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: '1px solid var(--action)', borderRadius: 999, padding: '4px 10px',
            fontSize: 12.5, color: 'var(--text-primary)',
          }}>
            {name}
            <button onClick={() => onRemove(code)} title="추천 대상에서 제외" style={{
              border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0,
            }}>×</button>
          </span>
        ))}
      </div>
    )}
    {showResults && (
    <div style={{
      background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12,
      padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
        기간 내 출고 없는 거래처 — 클릭하면 거래처 상세(추천견적) · ＋는 일괄 대상 추가
      </div>
      {fresh.slice(0, 5).map((c) => {
        const added = picked.has(c.client_code);
        return (
          <div
            key={c.client_code}
            onClick={() => onOpen({ code: c.client_code, name: c.client_name })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              padding: '7px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: '1px solid var(--border-default)', background: '#fff', color: 'var(--text-primary)',
            }}
          >
            <span style={{ fontWeight: 600, flex: 1 }}>{c.client_name}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.client_code}</span>
            <button
              onClick={(e) => { e.stopPropagation(); if (!added) onAdd({ code: c.client_code, name: c.client_name }); }}
              style={{
                border: `1px solid ${added ? 'var(--gray-300)' : 'var(--action)'}`,
                background: added ? 'var(--surface-muted)' : '#fff',
                color: added ? 'var(--status-success)' : 'var(--action)',
                borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700,
                cursor: added ? 'default' : 'pointer',
              }}
            >
              {added ? '추가됨 ✓' : '＋ 일괄 추가'}
            </button>
          </div>
        );
      })}
    </div>
    )}
    </>
  );
}
