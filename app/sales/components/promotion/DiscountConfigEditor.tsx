'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_DISCOUNT_CONFIG, type DiscountConfig, type Tier } from '@/app/lib/pricing/discountRate';

const box: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12, padding: 14, marginBottom: 10,
};
const inp: React.CSSProperties = {
  width: 68, padding: '5px 7px', borderRadius: 6, border: '1px solid var(--border-default)',
  fontSize: 12.5, textAlign: 'right', color: 'var(--text-primary)', background: '#fff',
};
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '6px 0' };
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', minWidth: 78 };
const unit: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)' };

// 값 표기: 할인율=%, 금액=만원, 수량/종=그대로
const Pct = ({ v, on }: { v: number; on: (n: number) => void }) => (
  <span><input style={inp} type="number" value={Math.round(v * 1000) / 10} onChange={(e) => on((Number(e.target.value) || 0) / 100)} /><span style={unit}> %</span></span>
);
const Man = ({ v, on }: { v: number; on: (n: number) => void }) => (
  <span><input style={inp} type="number" value={v / 10000} onChange={(e) => on((Number(e.target.value) || 0) * 10000)} /><span style={unit}> 만원</span></span>
);
const Num = ({ v, on, u }: { v: number; on: (n: number) => void; u: string }) => (
  <span><input style={inp} type="number" value={v} onChange={(e) => on(Number(e.target.value) || 0)} /><span style={unit}> {u}</span></span>
);

// 매출/수량 등급 tier 행: 기준값(만원 또는 개수) + 가산율
function TierRows({ tiers, unitLabel, money, onChange }: {
  tiers: Tier[]; unitLabel: string; money?: boolean; onChange: (t: Tier[]) => void;
}) {
  const setMin = (i: number, n: number) => onChange(tiers.map((t, j) => (j === i ? { ...t, min: n } : t)));
  const setAdd = (i: number, n: number) => onChange(tiers.map((t, j) => (j === i ? { ...t, add: n } : t)));
  return (
    <>
      {tiers.map((t, i) => (
        <div style={row} key={i}>
          <span style={lbl}>{i + 1}등급</span>
          {money
            ? <Man v={t.min} on={(n) => setMin(i, n)} />
            : <Num v={t.min} on={(n) => setMin(i, n)} u={unitLabel} />}
          <span style={unit}>이상 →</span>
          <Pct v={t.add} on={(n) => setAdd(i, n)} />
        </div>
      ))}
    </>
  );
}

export function DiscountConfigEditor() {
  const [cfg, setCfg] = useState<DiscountConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/sales/discount-config');
      const j = await r.json();
      setCfg(j.config || DEFAULT_DISCOUNT_CONFIG);
    } catch { setCfg(DEFAULT_DISCOUNT_CONFIG); }
  }, []);
  useEffect(() => { if (open && !cfg) load(); }, [open, cfg, load]);

  const patch = (fn: (c: DiscountConfig) => void) =>
    setCfg((prev) => { const c = structuredClone(prev!); fn(c); return c; });

  const save = async () => {
    if (!cfg) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/sales/discount-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '저장 실패');
      setMsg('저장됐어요.'); setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e instanceof Error ? e.message : '오류'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12,
        border: '1px solid var(--border-default)', background: 'var(--surface-muted)', cursor: 'pointer',
        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
      }}>
        {open ? '▾' : '▸'} 업태별 할인율 등급조건 (가격공식)
      </button>

      {open && cfg && (
        <div style={{ marginTop: 10 }}>
          {/* 업소/호텔 */}
          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>업소/호텔</div>
            <div style={row}><span style={lbl}>기본할인률</span><Pct v={cfg.venue.base} on={(n) => patch((c) => { c.venue.base = n; })} /></div>
            <div style={{ ...unit, marginTop: 4 }}>매출 등급</div>
            <TierRows tiers={cfg.venue.sales} unitLabel="원" money onChange={(t) => patch((c) => { c.venue.sales = t; })} />
            <div style={{ ...unit, marginTop: 4 }}>리스팅 품목수 등급</div>
            <TierRows tiers={cfg.venue.listing} unitLabel="종" onChange={(t) => patch((c) => { c.venue.listing = t; })} />
            <div style={row}><span style={lbl}>리델 가산</span><Pct v={cfg.venue.riedel} on={(n) => patch((c) => { c.venue.riedel = n; })} /></div>
          </div>

          {/* 샵 */}
          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>샵</div>
            <div style={row}><span style={lbl}>기본할인률</span><Pct v={cfg.shop.base} on={(n) => patch((c) => { c.shop.base = n; })} /></div>
            <div style={{ ...unit, marginTop: 4 }}>매출 등급</div>
            <TierRows tiers={cfg.shop.sales} unitLabel="원" money onChange={(t) => patch((c) => { c.shop.sales = t; })} />
            <div style={{ ...unit, marginTop: 4 }}>같은품목 매입수량 등급</div>
            <TierRows tiers={cfg.shop.qty} unitLabel="병" onChange={(t) => patch((c) => { c.shop.qty = t; })} />
          </div>

          {/* 도매 */}
          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>도매장</div>
            <div style={row}><span style={lbl}>기본(공급가 미만)</span><Man v={cfg.wholesale.priceThreshold} on={(n) => patch((c) => { c.wholesale.priceThreshold = n; })} /><span style={unit}>미만 →</span><Pct v={cfg.wholesale.baseLow} on={(n) => patch((c) => { c.wholesale.baseLow = n; })} /></div>
            <div style={row}><span style={lbl}>기본(공급가 이상)</span><Pct v={cfg.wholesale.baseHigh} on={(n) => patch((c) => { c.wholesale.baseHigh = n; })} /></div>
            <div style={{ ...unit, marginTop: 4 }}>같은품목 매입수량 등급</div>
            <TierRows tiers={cfg.wholesale.qty} unitLabel="병" onChange={(t) => patch((c) => { c.wholesale.qty = t; })} />
          </div>

          {/* 윈백 (전 업태 공통) */}
          <div style={box}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>윈백 (전 업태 공통)</div>
            <div style={row}><span style={lbl}>윈백 가산</span><Pct v={cfg.winback} on={(n) => patch((c) => { c.winback = n; })} /></div>
            <div style={unit}>발주 리듬이 끊긴 거래처(평소 주기 2배 경과=이탈위험, 3배=휴면)의 추천견적에 자동 합산</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={save} disabled={saving} style={{
              padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--action)', color: '#fff', fontSize: 13, fontWeight: 700,
            }}>{saving ? '저장 중…' : '등급조건 저장'}</button>
            <button onClick={() => setCfg(structuredClone(DEFAULT_DISCOUNT_CONFIG))} style={{
              padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}>기본값</button>
            {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
