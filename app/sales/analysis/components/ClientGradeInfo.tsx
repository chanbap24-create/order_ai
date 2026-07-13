"use client";

import { useEffect, useState } from "react";

type Metric = { key: string; label: string; unit: string; cur: number; next: number | null };
type GradeData = {
  category: "venue" | "shop" | "wholesale";
  grade: number;
  metrics: Metric[];
  benefit: { rate: number; breakdown: { base: number; sales: number; quantity: number; riedel: number }; riedel: boolean };
  nextSalesTier: { min: number; add: number; remain: number } | null;
};

const GRADE_COLOR = ["#8a8a8a", "var(--status-info)", "var(--status-success)", "var(--status-warning)", "var(--status-danger)"]; // 0..4
const won = (n: number) => (n >= 1_0000_0000 ? `${(n / 1_0000_0000).toFixed(1)}억` : n >= 1_0000 ? `${Math.round(n / 1_0000).toLocaleString()}만` : n.toLocaleString());
const pct = (r: number) => `${Math.round(r * 100)}%`;

/** 거래처 등급 · 다음 등급 조건 · 현재 혜택(할인). 직전 완료 분기 기준. */
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

  const color = GRADE_COLOR[Math.max(0, Math.min(4, d.grade))];
  const b = d.benefit.breakdown;
  // 다음 등급까지 부족한 지표
  const showBars = d.grade < 4 && d.metrics.some((m) => m.next != null);

  return (
    <div style={box}>
      {/* ① AI 추천 등급 (품목수·거래횟수 기준 — 추천 점수 가중치) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={tag}>🎯 AI추천 등급</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, background: color + "18", padding: "3px 10px", borderRadius: 6 }}>
          {d.grade > 0 ? `${d.grade}등급` : "기본"}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
          {d.grade >= 4 ? "🏆 최고 등급" : `다음 등급(${d.grade + 1}등급)까지 — 직전 분기 기준`}
        </span>
      </div>

      {/* 다음 등급 진행률 — 지표별 프로그레스 바 (부족분 시각화) */}
      {showBars && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
          {d.metrics.filter((m) => m.next != null).map((m) => {
            const next = m.next as number;
            const done = m.cur >= next;
            const ratio = Math.max(0.03, Math.min(1, next > 0 ? m.cur / next : 0));
            const fmtV = (v: number) => (m.key === "sales" ? won(v) : `${v}${m.unit}`);
            const remain = m.key === "sales" ? `${won(next - m.cur)}원 더` : `${next - m.cur}${m.unit} 더`;
            return (
              <div key={m.key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{m.label}</span>
                  <span style={{ fontSize: 11, color: done ? "var(--status-success)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtV(m.cur)} / {fmtV(next)}
                    {done
                      ? " ✓ 충족"
                      : <> · <b style={{ color: "var(--text-primary)" }}>{remain}</b></>}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--gray-100)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${ratio * 100}%`, borderRadius: 3,
                    background: done ? "var(--status-success)" : "var(--text-primary)",
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            모든 지표가 다음 문턱을 넘으면 {d.grade + 1}등급 — 다음 분기부터 추천에 취향·산지 반영 비중↑
          </div>
        </div>
      )}

      {/* ② 할인 등급/혜택 (매출 구간 기준) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-default)" }}>
        <span style={tag}>💰 할인 혜택</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--action)", background: "rgba(34,34,34,0.10)", padding: "3px 10px", borderRadius: 6 }}>
          할인 {pct(d.benefit.rate)}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
          기본 {pct(b.base)}{b.sales > 0 ? ` · 매출 +${pct(b.sales)}` : ""}{d.benefit.riedel && b.riedel > 0 ? ` · 리델 +${pct(b.riedel)}` : ""}
        </span>
      </div>

      {/* 다음 할인 구간 진행률 — 분기 매출 바 */}
      {d.nextSalesTier && (
        <div style={{ marginTop: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>다음 할인 구간</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
              {won(d.nextSalesTier.min - d.nextSalesTier.remain)} / {won(d.nextSalesTier.min)} ·{" "}
              <b style={{ color: "var(--text-primary)" }}>{won(d.nextSalesTier.remain)}원 더</b> →{" "}
              <b style={{ color: "var(--action)" }}>할인 +{pct(d.nextSalesTier.add)}</b>
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "var(--gray-100)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: "var(--text-primary)", transition: "width 0.4s ease",
              width: `${Math.max(3, Math.min(100, ((d.nextSalesTier.min - d.nextSalesTier.remain) / d.nextSalesTier.min) * 100))}%`,
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid var(--border-default)", borderRadius: 12, padding: "10px 14px", marginBottom: 16,
  background: "var(--surface-muted, #faf8f7)",
};
const tag: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--text-tertiary)", whiteSpace: "nowrap" };
