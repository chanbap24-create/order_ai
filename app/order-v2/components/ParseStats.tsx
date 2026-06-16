"use client";

import { useEffect, useState } from "react";

type Stats = {
  days: number;
  total: number;
  escalated: number;
  baseCost: number;
  escalationCost: number;
  totalCost: number;
};

/** 최근 N일 누적: 발주 건수 · 정밀보정(에스컬레이션) 비율 · 추정 비용 */
export function ParseStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/parse-stats?days=30")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success && d.stats) setStats(d.stats);
      })
      .catch(() => {
        /* 집계 실패는 무시 (발주 기능과 무관) */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!stats || stats.total === 0) return null;
  const rate = stats.total > 0 ? (stats.escalated / stats.total) * 100 : 0;

  return (
    <div
      title="불확실한 발주만 상위 모델(Sonnet)로 정밀 재매칭한 비율과 추정 비용입니다. 비용 단가는 추정치."
      style={{
        textAlign: "center",
        fontSize: 10,
        color: "#c8c0b8",
        marginTop: 4,
        marginBottom: 16,
        letterSpacing: "0.02em",
      }}
    >
      최근 {stats.days}일 · 발주 {stats.total.toLocaleString()}건 · 정밀보정 {rate.toFixed(0)}% ({stats.escalated.toLocaleString()}건) · 추정비용 ~${stats.totalCost.toFixed(2)} (추가 ~${stats.escalationCost.toFixed(2)})
    </div>
  );
}
