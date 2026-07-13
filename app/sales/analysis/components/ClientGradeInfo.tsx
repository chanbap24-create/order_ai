"use client";

import { useEffect, useState } from "react";

type Metric = {
  key: string; label: string; unit: string; cur: number; next: number | null;
  thresholds?: [number, number, number, number];
};
type Tier = { min: number; add: number };
type GradeData = {
  category: "venue" | "shop" | "wholesale";
  grade: number;
  metrics: Metric[];
  challenge?: { metrics: Metric[]; quarter: { start: string; end: string }; daysLeft: number; appliesFrom: string };
  benefit: { rate: number; breakdown: { base: number; sales: number; quantity: number; riedel: number }; riedel: boolean };
  nextSalesTier: { min: number; add: number; remain: number } | null;
  discountChallenge?: {
    sales: { cur: number; tiers: Tier[] } | null;
    listing: { cur: number; tiers: Tier[] } | null;
  };
};

/** 트랙 눈금: 값 + (있으면) 할인 가산 라벨 */
type Notch = { v: number; add?: number; isNext?: boolean };

const won = (n: number) => (n >= 1_0000_0000 ? `${(n / 1_0000_0000).toFixed(1)}억` : n >= 1_0000 ? `${Math.round(n / 1_0000).toLocaleString()}만` : n.toLocaleString());
const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * 거래처 등급 카드 — 멤버십 티어 UI.
 * ① 등급 스텝퍼 ② 이번 분기 도전 트랙 3개(분기 매출 → 품목수 → 거래횟수).
 *    품목수 트랙은 추천등급 눈금 + 할인 가산(+%)을 병기(리스팅과 동일 지표라 통합).
 * ③ 마지막 줄 = 현재 할인률(그래서 결론).
 */
export function ClientGradeInfo({ clientCode }: { clientCode: string }) {
  const [d, setD] = useState<GradeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/sales/clients/grade?client_code=${encodeURIComponent(clientCode)}`, { credentials: "include" });
        const j = await r.json();
        if (alive) setD(j?.grade != null ? j : null);
      } catch { /* ignore */ } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientCode]);

  if (loading) return <div style={box}><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>등급 불러오는 중…</span></div>;
  if (!d) return null;

  const b = d.benefit.breakdown;
  const ch = d.challenge;
  const dc = d.discountChallenge;
  const chMetrics = ch?.metrics ?? d.metrics;
  const mmdd = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  const deadline = ch ? new Date(new Date(ch.quarter.end).getTime() - 86400000).toISOString().slice(0, 10) : null;

  // ── 트랙 데이터 조립 (분기 매출 → 품목수 → 거래횟수) ──
  const items = chMetrics.find((m) => m.key === "items");
  const orders = chMetrics.find((m) => m.key === "orders");
  const recSales = chMetrics.find((m) => m.key === "sales"); // 샵만 존재

  // 매출: 추천등급 눈금(샵) + 할인 티어(+%) 병합
  const salesNotches: Notch[] = [];
  if (recSales?.thresholds) for (const t of [...new Set(recSales.thresholds)]) salesNotches.push({ v: t, isNext: recSales.next === t });
  for (const t of dc?.sales?.tiers || []) {
    const ex = salesNotches.find((n) => n.v === t.min);
    if (ex) ex.add = t.add; else salesNotches.push({ v: t.min, add: t.add });
  }
  salesNotches.sort((a, b) => a.v - b.v);
  const salesCur = dc?.sales?.cur ?? recSales?.cur ?? null;
  const nextDiscTier = dc?.sales?.tiers.find((t) => (salesCur ?? 0) < t.min) || null;

  // 품목수: 추천등급 눈금 + 리스팅 할인 가산 병기 (동일 지표 통합)
  const itemNotches: Notch[] = [];
  if (items?.thresholds) for (const t of [...new Set(items.thresholds)]) itemNotches.push({ v: t, isNext: items.next === t });
  for (const t of dc?.listing?.tiers || []) {
    const ex = itemNotches.find((n) => n.v === t.min);
    if (ex) ex.add = t.add; else itemNotches.push({ v: t.min, add: t.add });
  }
  itemNotches.sort((a, b) => a.v - b.v);

  const orderNotches: Notch[] = orders?.thresholds
    ? [...new Set(orders.thresholds)].map((t) => ({ v: t, isNext: orders.next === t }))
    : [];

  const showChallenge = d.grade < 4 && (salesNotches.length || itemNotches.length || orderNotches.length);

  return (
    <div style={box}>
      {/* ── ① 등급 여정 스텝퍼 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={sectionLabel}>AI 추천 등급</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>등급은 직전 분기 실적 기준</span>
      </div>
      <Stepper grade={d.grade} />

      {/* ── ② 이번 분기 도전: 분기 매출 → 품목수 → 거래횟수 ── */}
      {showChallenge ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {d.grade + 1}등급 도전 — 이번 분기 실적
            </span>
            {ch && deadline && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                background: ch.daysLeft <= 14 ? "var(--status-danger)" : "var(--text-primary)",
                color: "#fff", fontVariantNumeric: "tabular-nums",
              }}>
                {mmdd(deadline)} 마감 · D-{ch.daysLeft}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {salesCur != null && salesNotches.length > 0 && (
              <Track
                label="분기 매출" cur={salesCur} notches={salesNotches} money
                right={
                  <>
                    현재 <b style={hl}>{won(salesCur)}원</b>
                    {recSales?.next != null && salesCur < recSales.next && (
                      <> · 다음 등급까지 <b style={hl}>{won(recSales.next - salesCur)}원 더</b></>
                    )}
                    {nextDiscTier && <> · <b style={hl}>{won(nextDiscTier.min - salesCur)}원 더</b> → 할인 +{pct(nextDiscTier.add)}</>}
                    {!nextDiscTier && dc?.sales && " · ✓ 최고 할인 구간"}
                  </>
                }
              />
            )}
            {items && itemNotches.length > 0 && (
              <Track
                label="품목수" cur={items.cur} notches={itemNotches}
                right={
                  <>
                    현재 <b style={hl}>{items.cur}종</b>
                    {items.next != null && items.cur < items.next
                      ? <> · 다음 등급까지 <b style={hl}>{items.next - items.cur}종 더</b></>
                      : items.next != null ? " · ✓ 다음 등급 충족" : null}
                  </>
                }
              />
            )}
            {orders && orderNotches.length > 0 && (
              <Track
                label="거래횟수" cur={orders.cur} notches={orderNotches}
                right={
                  <>
                    현재 <b style={hl}>{orders.cur}일</b>
                    {orders.next != null && orders.cur < orders.next
                      ? <> · 다음 등급까지 <b style={hl}>{orders.next - orders.cur}일 더</b></>
                      : orders.next != null ? " · ✓ 다음 등급 충족" : null}
                  </>
                }
              />
            )}
          </div>
          {ch && (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
              {mmdd(deadline!)}까지 달성 시 <b style={{ color: "var(--text-primary)" }}>{mmdd(ch.appliesFrom)}부터 등급·할인율 반영</b>
              {" "}— 눈금의 <b style={{ color: "var(--text-primary)" }}>+%</b>는 할인 가산 구간
            </div>
          )}
        </>
      ) : d.grade >= 4 && (
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
          🏆 최고 등급 — 추천에 이 거래처의 취향·산지가 최대 비중으로 반영돼요
        </div>
      )}

      {/* ── ③ 그래서, 현재 할인률 ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-default)",
      }}>
        <span style={sectionLabel}>현재 할인률</span>
        <span style={{
          fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em",
          color: "#fff", background: "var(--action)", padding: "4px 12px", borderRadius: 8,
          fontVariantNumeric: "tabular-nums",
        }}>
          {pct(d.benefit.rate)}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
          기본 {pct(b.base)}
          {b.sales > 0 ? ` + 매출 ${pct(b.sales)}` : ""}
          {b.quantity > 0 ? ` + ${d.category === "venue" ? "품목수" : "수량"} ${pct(b.quantity)}` : ""}
          {d.benefit.riedel && b.riedel > 0 ? ` + 리델 ${pct(b.riedel)}` : ""}
        </span>
      </div>
    </div>
  );
}

/** 등급 여정: 기본 ─ 1 ─ 2 ─ 3 ─ 4. 달성 노드는 블랙 채움, 현재 노드 링 강조. */
function Stepper({ grade }: { grade: number }) {
  const steps = [0, 1, 2, 3, 4];
  return (
    <div style={{ position: "relative", padding: "0 4px" }}>
      <div style={{ position: "absolute", left: 14, right: 14, top: 10, height: 2, background: "var(--gray-200)" }} />
      <div style={{
        position: "absolute", left: 14, top: 10, height: 2, background: "var(--text-primary)",
        width: `calc((100% - 28px) * ${grade / 4})`, transition: "width 0.5s ease",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
        {steps.map((s) => {
          const reached = s <= grade;
          const current = s === grade;
          return (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 28 }}>
              <div style={{
                width: current ? 22 : 14, height: current ? 22 : 14, borderRadius: "50%",
                marginTop: current ? 0 : 4,
                background: reached ? "var(--text-primary)" : "#fff",
                border: reached ? "none" : "2px solid var(--gray-300)",
                boxShadow: current ? "0 0 0 4px var(--surface-active)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s ease",
              }}>
                {current && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{s}</span>}
              </div>
              <span style={{
                fontSize: 10, fontWeight: current ? 800 : 500,
                color: current ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap",
              }}>
                {s === 0 ? "기본" : `${s}등급`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 눈금 트랙: 등급 문턱 + 할인 가산(+%) 병기 눈금 위에 이번 분기 현재 위치. */
function Track({ label, cur, notches, money, right }: {
  label: string; cur: number; notches: Notch[]; money?: boolean; right: React.ReactNode;
}) {
  const max = notches[notches.length - 1].v;
  const scale = (v: number) => Math.min(100, (v / (max * 1.05)) * 100);
  const fmtV = (v: number) => (money ? won(v) : `${v}`);
  const allDone = cur >= max;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: allDone ? "var(--status-success)" : "var(--text-secondary)" }}>
          {right}
        </span>
      </div>
      <div style={{ position: "relative", height: 24 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 3, height: 6, borderRadius: 3, background: "var(--gray-100)" }} />
        <div style={{
          position: "absolute", left: 0, top: 3, height: 6, borderRadius: 3,
          width: `${Math.max(1.5, scale(cur))}%`,
          background: allDone ? "var(--status-success)" : "var(--text-primary)",
          transition: "width 0.5s ease",
        }} />
        {notches.map((n, i) => {
          const passed = cur >= n.v;
          return (
            <div key={i} style={{ position: "absolute", left: `${scale(n.v)}%`, top: 0, transform: "translateX(-50%)" }}>
              <div style={{
                width: n.isNext ? 3 : 2, height: 12, borderRadius: 1, margin: "0 auto",
                background: n.isNext ? "var(--text-primary)" : passed ? "rgba(255,255,255,0.9)" : "var(--gray-300)",
              }} />
              <div style={{
                fontSize: 9, marginTop: 2, textAlign: "center", whiteSpace: "nowrap",
                fontWeight: n.isNext ? 800 : 500, fontVariantNumeric: "tabular-nums",
                color: n.isNext ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {fmtV(n.v)}{n.add != null ? ` +${pct(n.add)}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px", marginBottom: 16,
  background: "#fff",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-tertiary)", whiteSpace: "nowrap",
};
const hl: React.CSSProperties = { color: "var(--text-primary)" };
