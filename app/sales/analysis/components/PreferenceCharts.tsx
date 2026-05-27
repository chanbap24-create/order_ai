"use client";

import type { PreferencesData } from "../types";
import { PREF_COLORS, TASTE_COLORS } from "../constants";

type Props = {
  prefs: PreferencesData | null;
  loading: boolean;
};

export function PreferenceCharts({ prefs, loading }: Props) {
  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>
        선호 분석 로딩 중...
      </div>
    );
  if (!prefs) return null;
  const hasData =
    prefs.priceRanges?.length ||
    prefs.regions?.length ||
    prefs.brands?.length ||
    prefs.grapes?.length ||
    prefs.tastes?.length;
  if (!hasData) return null;

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
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
        선호 분석 (최근 1년)
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {prefs.priceRanges?.length > 0 && (
          <PrefBarSection
            title="선호 가격대"
            data={prefs.priceRanges}
            nameKey="label"
            valueKey="amt"
          />
        )}
        {prefs.regions?.length > 0 && (
          <PrefBarSection title="선호 지역" data={prefs.regions} nameKey="name" valueKey="amt" />
        )}
        {prefs.brands?.length > 0 && (
          <PrefBarSection title="선호 브랜드" data={prefs.brands} nameKey="name" valueKey="amt" />
        )}
        {prefs.grapes?.length > 0 && (
          <PrefBarSection title="선호 품종" data={prefs.grapes} nameKey="name" valueKey="amt" />
        )}
      </div>

      {prefs.tastes?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            선호 테이스트 프로필
          </div>
          <TasteProfile tastes={prefs.tastes} />
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PrefBarSection({
  title,
  data,
  nameKey,
  valueKey,
}: {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  nameKey: string;
  valueKey: string;
}) {
  const maxVal = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((item, i) => {
          const val = item[valueKey] || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div
              key={item[nameKey]}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 80,
                  fontSize: 12,
                  color: "#555",
                  fontWeight: 500,
                  textAlign: "right",
                  flexShrink: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item[nameKey]}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 20,
                  background: "#f5f4f2",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    height: "100%",
                    background: PREF_COLORS[i % PREF_COLORS.length],
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <div
                style={{
                  width: 56,
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {val >= 1e8
                  ? (val / 1e8).toFixed(1) + "억"
                  : val >= 1e4
                    ? Math.round(val / 1e4) + "만"
                    : val.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasteProfile({ tastes }: { tastes: { name: string; count: number; qty: number }[] }) {
  const maxQty = Math.max(...tastes.map((t) => t.qty), 1);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {tastes.map((t) => {
        const pct = Math.round((t.qty / maxQty) * 100);
        const color = TASTE_COLORS[t.name] || "#999";
        return (
          <div
            key={t.name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 72,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: `conic-gradient(${color} ${pct * 3.6}deg, #f0ece6 ${pct * 3.6}deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                }}
              >
                {pct}%
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#555",
                fontWeight: 500,
                textAlign: "center",
                lineHeight: "1.2",
              }}
            >
              {t.name}
            </div>
            <div style={{ fontSize: 10, color: "#aaa" }}>{t.count}종</div>
          </div>
        );
      })}
    </div>
  );
}
