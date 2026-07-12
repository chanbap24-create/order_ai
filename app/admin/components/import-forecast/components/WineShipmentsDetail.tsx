"use client";

import { useEffect, useRef } from "react";
import type { WineShipment } from "../types";

type Props = {
  shipments: WineShipment[];
  loading: boolean;
  shipShowAll: boolean;
  setShipShowAll: React.Dispatch<React.SetStateAction<boolean>>;
  supplyPrice: number;
};

/** 와인 클릭 시 expand — 거래처별 그룹핑된 출고 이력 */
export function WineShipmentsDetail(p: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
      if (!atTop && !atBottom) e.stopPropagation();
    };
    el.addEventListener("wheel", handler, { passive: true });
    return () => el.removeEventListener("wheel", handler);
  }, [p.shipShowAll]);

  if (p.loading) {
    return <div style={{ padding: 12, fontSize: 12, color: "var(--neutral-100)" }}>조회 중...</div>;
  }
  if (p.shipments.length === 0) {
    return <div style={{ padding: 12, fontSize: 12, color: "var(--neutral-100)" }}>출고 이력 없음</div>;
  }

  const clientGroups: Record<
    string,
    {
      client: string;
      totalQty: number;
      prices: Record<number, number>;
      managers: Set<string>;
      lastDate: string;
    }
  > = {};
  for (const s of p.shipments) {
    if (!clientGroups[s.client])
      clientGroups[s.client] = {
        client: s.client,
        totalQty: 0,
        prices: {},
        managers: new Set(),
        lastDate: s.date,
      };
    const g = clientGroups[s.client];
    g.totalQty += s.qty;
    if (s.price > 0) g.prices[s.price] = (g.prices[s.price] || 0) + s.qty;
    if (s.manager) g.managers.add(s.manager);
    if (s.date > g.lastDate) g.lastDate = s.date;
  }
  const grouped = Object.values(clientGroups).sort((a, b) => b.totalQty - a.totalQty);
  const LIMIT = 10;
  const showSlice = p.shipShowAll ? grouped : grouped.slice(0, LIMIT);
  const hasMore = grouped.length > LIMIT;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 70px 60px",
          gap: 4,
          fontSize: 10,
          fontWeight: 500,
          color: "#bbb",
          padding: "6px 0 4px",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div>거래처</div>
        <div style={{ textAlign: "right" }}>공급가</div>
        <div style={{ textAlign: "right" }}>수량</div>
        <div style={{ textAlign: "right" }}>담당</div>
      </div>
      <div
        ref={p.shipShowAll ? scrollRef : undefined}
        style={
          p.shipShowAll
            ? {
                height: 400,
                overflowY: "scroll",
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                position: "relative",
                zIndex: 2,
              }
            : {}
        }
      >
        {showSlice.map((g, gi) => {
          const priceEntries = Object.entries(g.prices)
            .map(([price, qty]) => ({ price: Number(price), qty }))
            .sort((a, b) => b.qty - a.qty);
          const mgrs = [...g.managers].join("/");

          if (priceEntries.length <= 1) {
            return (
              <div
                key={gi}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 70px 60px",
                  gap: 4,
                  fontSize: 11,
                  padding: "4px 0",
                  borderBottom:
                    gi < showSlice.length - 1 ? "1px solid var(--border-default)" : "none",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    color: "var(--neutral-700)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.client}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    color:
                      priceEntries[0] && priceEntries[0].price < p.supplyPrice
                        ? "var(--status-warning)"
                        : "var(--neutral-100)",
                    fontWeight: 500,
                  }}
                >
                  {priceEntries[0] ? priceEntries[0].price.toLocaleString() : "-"}
                </div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "var(--neutral-800)" }}>
                  {g.totalQty}
                </div>
                <div style={{ textAlign: "right", color: "#bbb", fontSize: 10 }}>{mgrs}</div>
              </div>
            );
          }
          return (
            <div
              key={gi}
              style={{
                borderBottom: gi < showSlice.length - 1 ? "1px solid var(--border-default)" : "none",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 70px 60px",
                  gap: 4,
                  fontSize: 11,
                  padding: "4px 0",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    color: "var(--neutral-700)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.client}
                </div>
                <div style={{ textAlign: "right", color: "var(--neutral-100)", fontSize: 10 }}>
                  가격 {priceEntries.length}종
                </div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "var(--neutral-800)" }}>
                  {g.totalQty}
                </div>
                <div style={{ textAlign: "right", color: "#bbb", fontSize: 10 }}>{mgrs}</div>
              </div>
              {priceEntries.map((pe, pi) => (
                <div
                  key={pi}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 70px 60px",
                    gap: 4,
                    fontSize: 10,
                    padding: "2px 0 2px 12px",
                    color: "var(--neutral-200)",
                  }}
                >
                  <div></div>
                  <div
                    style={{
                      textAlign: "right",
                      color: pe.price < p.supplyPrice ? "var(--status-warning)" : "var(--neutral-100)",
                    }}
                  >
                    {pe.price.toLocaleString()}
                  </div>
                  <div style={{ textAlign: "right" }}>{pe.qty}</div>
                  <div></div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div
        style={{
          padding: "6px 0 0",
          fontSize: 11,
          color: "var(--neutral-100)",
          borderTop: "1px solid var(--border-default)",
          marginTop: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          {p.shipments.reduce((s, r) => s + r.qty, 0)}병 · {grouped.length}거래처
        </span>
        {hasMore && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              p.setShipShowAll((v) => !v);
            }}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--neutral-500)",
              background: "#fff",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: "3px 10px",
              cursor: "pointer",
              position: "relative",
              zIndex: 5,
            }}
          >
            {p.shipShowAll ? "10거래처" : `전체 ${grouped.length}거래처`}
          </button>
        )}
      </div>
    </>
  );
}
