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

const GRADE_COLOR = ["#8a8a8a", "#2563eb", "#16a34a", "#d97706", "#dc2626"]; // 0..4
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
  const gaps = d.metrics.filter((m) => m.next != null && m.cur < (m.next as number))
    .map((m) => `${m.label} ${m.key === "sales" ? `${won(m.next as number)}` : `${(m.next as number)}${m.unit}`}`);

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, background: color + "18", padding: "3px 10px", borderRadius: 6 }}>
          {d.grade > 0 ? `${d.grade}등급` : "기본 등급"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <b style={{ color: "var(--action)" }}>할인 {pct(d.benefit.rate)}</b>
          <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>
            (기본 {pct(b.base)}{b.sales > 0 ? ` · 매출 +${pct(b.sales)}` : ""}{d.benefit.riedel && b.riedel > 0 ? ` · 리델 +${pct(b.riedel)}` : ""})
          </span>
        </span>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.6 }}>
        {d.grade >= 4
          ? <span>🏆 최고 등급 달성</span>
          : gaps.length > 0
            ? <span>다음 등급까지: <b style={{ color: "var(--text-secondary)" }}>{gaps.join(" · ")}</b> 이상 (직전 분기 기준)</span>
            : <span>다음 등급 조건 충족 — 다음 분기 반영</span>}
        {d.nextSalesTier && (
          <span style={{ display: "block" }}>
            매출 <b style={{ color: "var(--text-secondary)" }}>{won(d.nextSalesTier.remain)}원</b> 더 → 할인 <b style={{ color: "var(--action)" }}>+{pct(d.nextSalesTier.add)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", marginBottom: 16,
  background: "var(--surface-muted, #faf8f7)",
};
