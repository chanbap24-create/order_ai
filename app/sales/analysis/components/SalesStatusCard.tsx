"use client";

import type { DetailStats } from "../types";
import { fmt } from "../lib/format";

type Props = { stats: DetailStats | null };

export function SalesStatusCard({ stats }: Props) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        padding: 20,
        boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#2c1810", marginBottom: 12 }}>
        매출 현황 (최근 1년)
      </div>
      {stats ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatBox value={fmt(stats.totalSales)} label="총 매출" valueColor="#5A1515" />
            <StatBox
              value={String(stats.itemStats?.length || 0)}
              label="구매 품목 수"
              valueColor="#2c1810"
            />
            <StatBox
              value={stats.lastShipDate || "-"}
              label="최근 출고일"
              valueColor="#2c1810"
              small
            />
          </div>
          {stats.itemStats && stats.itemStats.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2c1810", marginBottom: 8 }}>
                주요 구매 품목
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {stats.itemStats.slice(0, 10).map((item) => (
                  <div
                    key={item.item_no}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1, color: "#2c1810" }}>{item.item_name}</span>
                    <span style={{ color: "#a8a098", fontSize: 12 }}>{item.buy_count}회</span>
                    <span style={{ color: "#5A1515", fontWeight: 600, fontSize: 12 }}>
                      {item.avg_price ? fmt(item.avg_price) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats.recentShipments && stats.recentShipments.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2c1810", marginBottom: 8 }}>
                최근 출고
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {stats.recentShipments.slice(0, 10).map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#aaa", width: 72 }}>
                      {s.ship_date?.toString().slice(0, 10)}
                    </span>
                    <span style={{ flex: 1, color: "#2c1810" }}>{s.item_name}</span>
                    <span style={{ color: "#a8a098", fontSize: 12 }}>{s.quantity}개</span>
                    <span style={{ color: "#5A1515", fontWeight: 600, fontSize: 12 }}>
                      {s.total_amount ? fmt(s.total_amount) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ color: "#a8a098", fontSize: 13 }}>출고 이력 없음</div>
      )}
    </div>
  );
}

function StatBox({
  value,
  label,
  valueColor,
  small = false,
}: {
  value: string;
  label: string;
  valueColor: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "12px 0",
        background: "#f8f7f5",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: small ? 14 : 20, fontWeight: small ? 600 : 700, color: valueColor }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#a8a098", marginTop: 2 }}>{label}</div>
    </div>
  );
}
