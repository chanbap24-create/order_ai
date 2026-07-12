"use client";

import { ORDER_COLORS, ORDER_FONT } from "../order-v2/constants";
import { StockResultCard } from "./components/StockResultCard";
import { useStockQuery } from "./hooks/useStockQuery";

export default function StockPage() {
  const { query, setQuery, tab, setTab, items, loading, error, run } = useStockQuery();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 20px 48px", fontFamily: ORDER_FONT.base, minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: ORDER_COLORS.text, marginBottom: 4 }}>📦 재고 조회</h1>
      <p style={{ fontSize: 13, color: ORDER_COLORS.textMuted, marginBottom: 20 }}>
        품번·와인명·모델번호·브랜드 약어로 검색 (예: &quot;0884/0 재고&quot;, &quot;로쉬벨렌 샤도&quot;)
      </p>

      <div style={{ background: ORDER_COLORS.surface, borderRadius: 12, padding: 18, border: "1px solid var(--action-muted)", marginBottom: 20 }}>
        {/* 탭 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["CDV", "DL"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: tab === t ? "var(--action)" : "var(--surface)",
                color: tab === t ? "#fff" : ORDER_COLORS.textMuted,
                boxShadow: tab === t ? "none" : "inset 0 0 0 1px var(--border-default)",
              }}
            >
              {t === "CDV" ? "와인 (까브드뱅)" : "글라스 (대유라이프)"}
            </button>
          ))}
        </div>

        {/* 입력 */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            placeholder="품목 검색…"
            autoFocus
            style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-default)", fontSize: 15, background: "var(--surface)", color: ORDER_COLORS.text }}
          />
          <button
            onClick={run}
            disabled={loading || !query.trim()}
            style={{
              padding: "12px 22px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 800, cursor: loading ? "default" : "pointer",
              background: "var(--action)", color: "#fff", opacity: loading || !query.trim() ? 0.6 : 1, whiteSpace: "nowrap",
            }}
          >
            {loading ? "조회 중…" : "조회"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(180,50,50,0.08)", color: ORDER_COLORS.confLow, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {items && items.length === 0 && !loading && (
        <div style={{ textAlign: "center", color: ORDER_COLORS.textMuted, fontSize: 14, padding: "32px 0" }}>
          매칭되는 품목이 없습니다. 다른 표현으로 검색해보세요.
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: ORDER_COLORS.textMuted, marginBottom: 10 }}>{items.length}개 품목</div>
          {items.map((it) => <StockResultCard key={it.item_no} item={it} />)}
        </>
      )}
    </div>
  );
}
