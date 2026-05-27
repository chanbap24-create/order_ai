"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
  isSearching: boolean;
  activeFilterCount: number;
  showAdvancedFilter: boolean;
  onToggleAdvanced: () => void;
  onSearch: () => void;
};

/**
 * 검색 인풋 + 필터 토글 + 검색 버튼.
 * height 44 (주 액션이라 강조 — 다른 페이지 input 34보다 큼)
 */
export function SearchBar({
  value,
  onChange,
  focused,
  setFocused,
  isSearching,
  activeFilterCount,
  showAdvancedFilter,
  onToggleAdvanced,
  onSearch,
}: Props) {
  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={focused ? "var(--action)" : "var(--text-muted)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          transition: "stroke 0.15s ease",
          pointerEvents: "none",
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="와인명 또는 품번 검색"
        disabled={isSearching}
        style={{
          width: "100%",
          height: 44,
          paddingLeft: 40,
          paddingRight: 110,
          border: `1px solid ${focused ? "var(--action)" : "var(--border-default)"}`,
          borderRadius: 8,
          fontSize: 14,
          background: "var(--surface)",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxShadow: focused ? "var(--focus-ring)" : "none",
          color: "var(--text-primary)",
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <button
          onClick={onToggleAdvanced}
          title="고급 필터"
          style={{
            position: "relative",
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "none",
            background:
              activeFilterCount > 0
                ? "var(--surface-active)"
                : showAdvancedFilter
                  ? "var(--surface-hover)"
                  : "transparent",
            color: activeFilterCount > 0 ? "var(--action)" : "var(--text-tertiary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.12s ease, color 0.12s ease",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {activeFilterCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--action)",
                color: "var(--text-on-primary)",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={onSearch}
          disabled={isSearching}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            border: "1px solid var(--action)",
            background: "var(--action)",
            color: "var(--text-on-primary)",
            fontWeight: 700,
            fontSize: 12,
            cursor: isSearching ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.12s ease",
            opacity: isSearching ? 0.6 : 1,
            letterSpacing: "0.02em",
          }}
        >
          {isSearching ? "검색중" : "검색"}
        </button>
      </div>
    </div>
  );
}
