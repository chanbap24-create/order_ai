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

/** 상단 검색 인풋 + 필터 토글 + 검색 버튼 */
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
    <div style={{ position: "relative", marginBottom: 10 }}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={focused ? "#5A1515" : "#BCBCBC"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          transition: "stroke 0.2s ease",
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
        placeholder="Search wine or item code..."
        disabled={isSearching}
        style={{
          width: "100%",
          height: 48,
          paddingLeft: 42,
          paddingRight: 96,
          border: `1.5px solid ${focused ? "#5A1515" : "#E5E5E5"}`,
          borderRadius: 12,
          fontSize: 16,
          background: "white",
          outline: "none",
          transition: "all 0.2s ease",
          boxShadow: focused ? "0 0 0 3px rgba(90,21,21,0.06)" : "0 1px 2px rgba(0,0,0,0.04)",
          color: "#1a1a2e",
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
          style={{
            position: "relative",
            width: 34,
            height: 34,
            borderRadius: 6,
            border: "none",
            background:
              activeFilterCount > 0
                ? "rgba(90,21,21,0.1)"
                : showAdvancedFilter
                  ? "#F0EFED"
                  : "transparent",
            color: activeFilterCount > 0 ? "#5A1515" : "#999",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
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
                top: -4,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#5A1515",
                color: "white",
                fontSize: "0.6rem",
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
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "#F0EFED",
            color: "#5A1515",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: isSearching ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            opacity: isSearching ? 0.6 : 1,
          }}
        >
          {isSearching ? "검색중" : "검색"}
        </button>
      </div>
    </div>
  );
}
