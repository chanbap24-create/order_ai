"use client";

import { useEffect, useState } from "react";

type Metric = {
  key: string; label: string; unit: string; cur: number; next: number | null;
  thresholds?: [number, number, number, number];
};
type GradeData = {
  category: "venue" | "shop" | "wholesale";
  grade: number;
  metrics: Metric[];
  challenge?: { metrics: Metric[]; quarter: { start: string; end: string }; daysLeft: number; appliesFrom: string };
  benefit: { rate: number; breakdown: { base: number; sales: number; quantity: number; riedel: number }; riedel: boolean };
  nextSalesTier: { min: number; add: number; remain: number } | null;
  discountChallenge?: {
    sales: { cur: number; tiers: Array<{ min: number; add: number }> } | null;
    listing: { cur: number; tiers: Array<{ min: number; add: number }> } | null;
  };
};

const won = (n: number) => (n >= 1_0000_0000 ? `${(n / 1_0000_0000).toFixed(1)}억` : n >= 1_0000 ? `${Math.round(n / 1_0000).toLocaleString()}만` : n.toLocaleString());
const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * 거래처 등급 카드 — 멤버십 티어 UI.
 * ① 등급 스텝퍼(기본→4등급 여정) ② 지표별 눈금 트랙(전체 문턱 위 현재 위치)
 * ③ 할인 혜택 + 다음 구간. 직전 완료 분기 기준.
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
  // 도전 트랙 = 이번 분기(진행 중) 실적 vs 다음 등급 문턱. 없으면(구버전 응답) 직전 분기로 폴백.
  const ch = d.challenge;
  const trackMetrics = (ch?.metrics ?? d.metrics).filter((m) => Array.isArray(m.thresholds) && m.thresholds.length === 4);
  const mmdd = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  // 마감 = 분기 end(다음 분기 1일)의 전날
  const deadline = ch ? new Date(new Date(ch.quarter.end).getTime() - 86400000).toISOString().slice(0, 10) : null;

  return (
    <div style={box}>
      {/* ── ① 등급 여정 스텝퍼 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={sectionLabel}>AI 추천 등급</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>등급은 직전 분기 실적 기준</span>
      </div>
      <Stepper grade={d.grade} />

      {/* ── ② 다음 등급 도전 — 이번 분기 실적 vs 목표 문턱 ── */}
      {d.grade < 4 && trackMetrics.length > 0 && (
        <>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 18, marginBottom: 10,
          }}>
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
            {trackMetrics.map((m) => <NotchTrack key={m.key} m={m} grade={d.grade} />)}
          </div>
          {ch && (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
              {mmdd(deadline!)}까지 모든 지표 달성 시 <b style={{ color: "var(--text-primary)" }}>{mmdd(ch.appliesFrom)}부터 {d.grade + 1}등급</b> 적용
              — 추천에 취향·산지 반영 비중↑
            </div>
          )}
        </>
      )}
      {d.grade >= 4 && (
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
          🏆 최고 등급 — 추천에 이 거래처의 취향·산지가 최대 비중으로 반영돼요
        </div>
      )}

      {/* ── ③ 할인 혜택 ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-default)",
      }}>
        <span style={sectionLabel}>할인 혜택</span>
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
          {b.quantity > 0 ? ` + ${d.category === "venue" ? "리스팅" : "수량"} ${pct(b.quantity)}` : ""}
          {d.benefit.riedel && b.riedel > 0 ? ` + 리델 ${pct(b.riedel)}` : ""}
        </span>
      </div>

      {/* 할인 등급 도전 트랙 — 이번 분기 매출·리스팅 (가격공식 A표) */}
      {(d.discountChallenge?.sales || d.discountChallenge?.listing) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
          {d.discountChallenge.sales && (
            <TierTrack
              label="분기 매출"
              cur={d.discountChallenge.sales.cur}
              tiers={d.discountChallenge.sales.tiers}
              money
            />
          )}
          {d.discountChallenge.listing && (
            <TierTrack
              label="리스팅 품목수"
              cur={d.discountChallenge.listing.cur}
              tiers={d.discountChallenge.listing.tiers}
              unit="종"
            />
          )}
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            이번 분기 실적 기준 — 분기 마감까지 구간 달성 시 <b style={{ color: "var(--text-primary)" }}>다음 분기 할인율에 반영</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** 할인 구간 트랙: 티어 눈금(금액/수량 + 가산율) 위에 이번 분기 현재 위치. */
function TierTrack({ label, cur, tiers, money, unit = "" }: {
  label: string; cur: number; tiers: Array<{ min: number; add: number }>; money?: boolean; unit?: string;
}) {
  if (!tiers.length) return null;
  const max = tiers[tiers.length - 1].min;
  const scale = (v: number) => Math.min(100, (v / (max * 1.06)) * 100);
  const fmtV = (v: number) => (money ? won(v) : `${v}`);
  const next = tiers.find((t) => cur < t.min) || null;
  const topDone = !next;
  const attained = [...tiers].reverse().find((t) => cur >= t.min) || null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: topDone ? "var(--status-success)" : "var(--text-secondary)" }}>
          현재 <b style={{ color: "var(--text-primary)", fontSize: 12.5 }}>{fmtV(cur)}{money ? "원" : unit}</b>
          {attained && <> · 달성 <b style={{ color: "var(--status-success)" }}>+{pct(attained.add)}</b></>}
          {next && <> · <b style={{ color: "var(--text-primary)" }}>{money ? `${won(next.min - cur)}원` : `${next.min - cur}${unit}`} 더</b> → +{pct(next.add)}</>}
          {topDone && " · ✓ 최고 구간"}
        </span>
      </div>
      <div style={{ position: "relative", height: 24 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 3, height: 6, borderRadius: 3, background: "var(--gray-100)" }} />
        <div style={{
          position: "absolute", left: 0, top: 3, height: 6, borderRadius: 3,
          width: `${Math.max(1.5, scale(cur))}%`,
          background: topDone ? "var(--status-success)" : "var(--text-primary)",
          transition: "width 0.5s ease",
        }} />
        {tiers.map((t, i) => {
          const isNext = next != null && t.min === next.min;
          const passed = cur >= t.min;
          return (
            <div key={i} style={{ position: "absolute", left: `${scale(t.min)}%`, top: 0, transform: "translateX(-50%)" }}>
              <div style={{
                width: isNext ? 3 : 2, height: 12, borderRadius: 1, margin: "0 auto",
                background: isNext ? "var(--text-primary)" : passed ? "rgba(255,255,255,0.9)" : "var(--gray-300)",
              }} />
              <div style={{
                fontSize: 9, marginTop: 2, textAlign: "center", whiteSpace: "nowrap",
                fontWeight: isNext ? 800 : 500, fontVariantNumeric: "tabular-nums",
                color: isNext ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {fmtV(t.min)}{money ? "" : unit} +{pct(t.add)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 등급 여정: 기본 ─ 1 ─ 2 ─ 3 ─ 4. 달성 노드는 블랙 채움, 현재 노드 링 강조. */
function Stepper({ grade }: { grade: number }) {
  const steps = [0, 1, 2, 3, 4];
  return (
    <div style={{ position: "relative", padding: "0 4px" }}>
      {/* 트랙 라인 */}
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

/** 지표 눈금 트랙: 전체 문턱(1~4등급) 눈금 위에 현재 위치. 다음 문턱까지 부족분 강조. */
function NotchTrack({ m, grade }: { m: Metric; grade: number }) {
  const thr = m.thresholds as [number, number, number, number];
  const max = thr[3];
  const scale = (v: number) => Math.min(100, (v / max) * 100);
  const isSales = m.key === "sales";
  const fmtV = (v: number) => (isSales ? won(v) : `${v}`);
  const next = m.next;
  const done = next != null && m.cur >= next;
  const remainTxt = next != null && !done
    ? (isSales ? `${won(next - m.cur)}원 더` : `${next - m.cur}${m.unit} 더`)
    : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)" }}>{m.label}</span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: done ? "var(--status-success)" : "var(--text-secondary)" }}>
          현재 <b style={{ color: "var(--text-primary)", fontSize: 12.5 }}>{fmtV(m.cur)}{isSales ? "원" : m.unit}</b>
          {done && " · ✓ 다음 등급 충족"}
          {remainTxt && <> · 다음 등급까지 <b style={{ color: "var(--text-primary)" }}>{remainTxt}</b></>}
        </span>
      </div>
      <div style={{ position: "relative", height: 22 }}>
        {/* 트랙 + 채움 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 3, height: 6, borderRadius: 3, background: "var(--gray-100)" }} />
        <div style={{
          position: "absolute", left: 0, top: 3, height: 6, borderRadius: 3,
          width: `${Math.max(1.5, scale(m.cur))}%`,
          background: done ? "var(--status-success)" : "var(--text-primary)",
          transition: "width 0.5s ease",
        }} />
        {/* 등급 문턱 눈금 + 라벨 */}
        {thr.map((t, i) => {
          const isNext = next != null && t === next && i === grade; // 현 등급의 다음 문턱
          const passed = m.cur >= t;
          return (
            <div key={i} style={{ position: "absolute", left: `${scale(t)}%`, top: 0, transform: "translateX(-50%)" }}>
              <div style={{
                width: isNext ? 3 : 2, height: 12, borderRadius: 1, margin: "0 auto",
                background: isNext ? "var(--text-primary)" : passed ? "rgba(255,255,255,0.9)" : "var(--gray-300)",
              }} />
              <div style={{
                fontSize: 9, marginTop: 2, textAlign: "center", whiteSpace: "nowrap",
                fontWeight: isNext ? 800 : 500, fontVariantNumeric: "tabular-nums",
                color: isNext ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {fmtV(t)}
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
