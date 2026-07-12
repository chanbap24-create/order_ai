"use client";

import type { ManagerStat } from "../types";

const CHANNEL_COLORS: Record<string, string> = {
  "on/업소": "var(--status-danger)",
  "on/호텔": "var(--status-danger)",
  "on/샵": "var(--status-warning)",
  "on/도매장": "#f39c12",
  "off/백화점": "#3498db",
  "off/편의점": "#2980b9",
  "off/할인점": "#1abc9c",
  백화점: "#3498db",
  "백화점(와인)": "#2c6faa",
  "etc/기타": "#95a5a6",
  "(미분류)": "#bdc3c7",
};

type Props = { activeData: ManagerStat };

export function ChannelsTab({ activeData }: Props) {
  const chs = activeData.channels || [];
  if (chs.length === 0) return null;
  const maxQty = chs[0]?.qty || 1;

  return (
    <div style={{ padding: "16px 20px" }}>
      {chs.map((ch) => {
        const pct = Math.round((ch.qty / maxQty) * 100);
        const color = CHANNEL_COLORS[ch.channel] || "var(--neutral-100)";
        return (
          <div key={ch.channel} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 3,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--neutral-800)" }}>{ch.channel}</span>
                <span style={{ fontSize: 11, color: "#bbb" }}>{ch.pct}%</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--neutral-100)" }}>
                <span>{ch.clients}거래처</span>
                <span>{ch.wines}와인</span>
                <span style={{ fontWeight: 600, color: "var(--neutral-800)" }}>
                  {ch.annual_qty.toLocaleString()}/년
                </span>
              </div>
            </div>
            <div
              style={{
                height: 20,
                background: "var(--gray-100)",
                borderRadius: 3,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.3s",
                  minWidth: 4,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: pct > 35 ? "#fff" : "var(--neutral-800)",
                }}
              >
                {ch.qty.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {chs
          .filter((c) => c.qty_per_wine > 0)
          .map((ch) => {
            const color = CHANNEL_COLORS[ch.channel] || "var(--neutral-100)";
            return (
              <span
                key={ch.channel}
                style={{
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: "var(--gray-50)",
                  border: "1px solid var(--border-default)",
                  fontSize: 11,
                  color: "var(--neutral-700)",
                }}
              >
                {ch.channel} <strong style={{ color }}>{ch.qty_per_wine}</strong>/년
              </span>
            );
          })}
      </div>
    </div>
  );
}
