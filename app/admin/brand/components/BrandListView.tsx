"use client";

import type { Brand, BrandWithWineCount } from "@/app/types/wine";

type Props = {
  brands: BrandWithWineCount[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  countryFilter: string;
  setCountryFilter: (v: string) => void;
  countries: string[];
  onSelect: (brand: Brand) => void;
  onNew: () => void;
};

export function BrandListView(p: Props) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={p.searchQuery}
          onChange={(e) => p.setSearchQuery(e.target.value)}
          placeholder="브랜드 검색..."
          style={{
            flex: 1,
            minWidth: 160,
            height: 36,
            padding: "0 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            fontSize: 13,
            outline: "none",
            background: "#fff",
          }}
        />
        <select
          value={p.countryFilter}
          onChange={(e) => p.setCountryFilter(e.target.value)}
          style={{
            height: 36,
            padding: "0 10px",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            fontSize: 13,
            background: "#fff",
            color: p.countryFilter ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          <option value="">전체 국가</option>
          {p.countries.sort().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={p.onNew}
          style={{
            height: 36,
            padding: "0 16px",
            background: "var(--action)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + 신규 등록
        </button>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        총 {p.brands.length}개 브랜드
      </div>

      {p.loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>로딩 중...</div>
      ) : p.brands.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          등록된 브랜드가 없습니다
        </div>
      ) : (
        <>
          {(() => {
            const notDone = p.brands.filter((b) => !b.ai_researched);
            const done = p.brands.filter((b) => b.ai_researched);
            return (
              <>
                <BrandGroup title="미조사" count={notDone.length} accent="var(--status-warning, #b8860b)" brands={notDone} onSelect={p.onSelect} />
                <BrandGroup title="조사 완료" count={done.length} accent="var(--status-success)" brands={done} onSelect={p.onSelect} />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

function BrandGroup(p: {
  title: string;
  count: number;
  accent: string;
  brands: BrandWithWineCount[];
  onSelect: (b: BrandWithWineCount) => void;
}) {
  if (p.count === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.accent }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>{p.title}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.count}개</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {p.brands.map((brand) => (
          <BrandCard key={brand.id} brand={brand} onClick={() => p.onSelect(brand)} />
        ))}
      </div>
    </div>
  );
}

function BrandCard({ brand, onClick }: { brand: BrandWithWineCount; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid var(--action-muted)",
        borderRadius: 12,
        padding: 16,
        cursor: "pointer",
        transition: "box-shadow 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--action-muted)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        {brand.image_url || brand.logo_url ? (
          <img
            src={brand.logo_url || brand.image_url || ""}
            alt={brand.brand_name_kr}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              objectFit: "cover",
              background: "var(--surface-muted)",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "var(--surface-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            {brand.brand_code || brand.brand_name_kr.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {brand.brand_name_kr}
          </div>
          {brand.brand_name_en && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>
              {brand.brand_name_en}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {brand.brand_code && (
          <Chip bg="var(--action-muted)" color="var(--action)" bold>
            {brand.brand_code}
          </Chip>
        )}
        {brand.country && <Chip>{brand.country}</Chip>}
        {brand.region && <Chip>{brand.region}</Chip>}
      </div>

      {brand.description && (
        <div
          style={{
            fontSize: 12,
            color: "#6b6560",
            lineHeight: 1.5,
            marginBottom: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {brand.description}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>와인 {brand.wine_count}개</span>
        {brand.ai_researched && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              background: "var(--status-success-bg)",
              color: "var(--status-success)",
              padding: "2px 5px",
              borderRadius: 3,
            }}
          >
            AI
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({
  children,
  bg = "var(--border-subtle)",
  color = "var(--text-tertiary)",
  bold = false,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: bold ? 600 : 400,
        background: bg,
        color,
        padding: "2px 6px",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}
