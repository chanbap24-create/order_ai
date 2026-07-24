'use client';

// 추천 결과 — 순차 등장 카드. 손님이 고른 와인은 [이 와인 구매]로 이력 기록.
import { useState } from 'react';
import type { SommelierResult } from '@/app/lib/sommelierRecommend';

const won = (n: number) => n.toLocaleString('ko-KR');

export function ResultCards({ customerName, customerId, sessionId, results, onRetry }: {
  customerName: string;
  customerId: number;
  sessionId: number | null;
  results: SommelierResult[];
  onRetry: () => void;
}) {
  const [ordered, setOrdered] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const order = async (r: SommelierResult) => {
    if (ordered.has(r.item_code) || busy) return;
    setBusy(r.item_code);
    try {
      const res = await fetch('/api/sommelier/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId, sessionId, itemCode: r.item_code, itemName: r.name,
          retailPrice: r.retail_price, quantity: 1,
        }),
      });
      if (res.ok) setOrdered((s) => new Set(s).add(r.item_code));
      else alert('구매 기록에 실패했습니다.');
    } catch {
      alert('구매 기록에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  if (results.length === 0) {
    return (
      <div className="som-up" style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>조건에 맞는 와인을 찾지 못했어요</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>가격대나 타입을 넓혀서 다시 찾아볼까요?</div>
        <button onClick={onRetry} className="som-cta" style={retryStyle}>다시 찾아보기</button>
      </div>
    );
  }

  return (
    <div>
      <div className="som-up" style={{ ['--i' as string]: 0, textAlign: 'center', padding: '8px 0 4px' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.3em', color: 'var(--text-muted)', fontWeight: 600 }}>SELECTION</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
          {customerName} 님을 위한 추천
        </h2>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>취향에 가장 가까운 {results.length}종을 골랐어요</div>
      </div>

      <div style={{ marginTop: 14 }}>
        {results.map((r, i) => {
          const done = ordered.has(r.item_code);
          return (
            <div key={r.item_code} className="som-up" style={{
              ['--i' as string]: i + 1,
              display: 'flex', gap: 16, padding: '22px 0',
              borderBottom: i === results.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            }}>
              <div style={{ width: 84, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/sales/wine-img?code=${encodeURIComponent(r.item_code)}`} alt={r.name}
                  style={{ maxHeight: 130, maxWidth: 84, objectFit: 'contain' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  NO.{i + 1}
                </div>
                <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3, letterSpacing: '-0.01em' }}>
                  {r.name}
                </div>
                {r.name_en && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{r.name_en}</div>}
                {(r.country || r.region) && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {[r.country, r.region].filter(Boolean).join(' · ')}
                  </div>
                )}
                {r.flavors.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {r.flavors.map((f) => (
                      <span key={f} style={{
                        fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 999, padding: '2px 9px',
                      }}>{f}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 9, lineHeight: 1.55 }}>
                  {r.reason}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {won(r.retail_price)}원
                  </span>
                  <button onClick={() => order(r)} disabled={done || busy === r.item_code} className="som-cta" style={{
                    marginLeft: 'auto', height: 38, padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: done ? '1px solid var(--border-default)' : 'none',
                    background: done ? 'var(--surface)' : 'var(--action)',
                    color: done ? 'var(--text-tertiary)' : 'var(--text-on-primary)',
                    cursor: done ? 'default' : 'pointer',
                  }}>
                    {done ? '✓ 구매 기록됨' : busy === r.item_code ? '기록 중…' : '이 와인 구매'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="som-up" style={{ ['--i' as string]: results.length + 1, textAlign: 'center', marginTop: 8 }}>
        <button onClick={onRetry} className="som-cta" style={retryStyle}>다른 취향으로 다시 찾기</button>
      </div>
    </div>
  );
}

const retryStyle: React.CSSProperties = {
  marginTop: 16, height: 46, padding: '0 26px', borderRadius: 10, fontSize: 14, fontWeight: 600,
  border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer',
};
