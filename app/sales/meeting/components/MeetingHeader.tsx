"use client";

import type { ViewMode } from "../types";
import { Section } from "@/app/components/ui";
import { selectStyle, labelStyle } from "@/app/styles/controls";

type Props = {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  isAdmin: boolean;
  managers: string[];
  filterManager: string;
  setFilterManager: (v: string) => void;
  rangeLabel: string;
  weekStart: Date;
  prevPeriod: () => void;
  nextPeriod: () => void;
  goToday: () => void;
};

export function MeetingHeader(p: Props) {
  return (
    <Section padding="sm">
      <div
        style={{
          display: "flex",
          alignItems: "end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={labelStyle}>보기</div>
          <SegmentedToggle
            value={p.viewMode}
            options={[
              { value: "week", label: "주간" },
              { value: "month", label: "월간" },
            ]}
            onChange={(v) => p.setViewMode(v as ViewMode)}
          />
        </div>

        <div>
          <div style={labelStyle}>기간</div>
          <div style={{ display: "flex", alignItems: "stretch", height: 34 }}>
            <NavButton onClick={p.prevPeriod} variant="left" />
            <button
              onClick={p.goToday}
              style={{
                height: 34,
                minWidth: 160,
                padding: "0 16px",
                border: "1px solid var(--border-default)",
                borderLeft: "none",
                borderRight: "none",
                background: "var(--surface)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "'DM Sans', sans-serif",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              title="오늘로 이동"
            >
              {p.rangeLabel}
              {p.viewMode === "week" && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {p.weekStart.getFullYear()}
                </span>
              )}
            </button>
            <NavButton onClick={p.nextPeriod} variant="right" />
          </div>
        </div>

        {p.isAdmin && p.managers.length > 0 && (
          <div style={{ minWidth: 160 }}>
            <div style={labelStyle}>담당자</div>
            <select
              value={p.filterManager}
              onChange={(e) => p.setFilterManager(e.target.value)}
              style={selectStyle}
            >
              <option value="">전체 담당자</option>
              {p.managers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Section>
  );
}

function NavButton({
  onClick,
  variant,
}: {
  onClick: () => void;
  variant: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={variant === "left" ? "이전" : "다음"}
      style={{
        width: 34,
        height: 34,
        border: "1px solid var(--border-default)",
        background: "var(--surface)",
        color: "var(--text-tertiary)",
        cursor: "pointer",
        borderRadius: variant === "left" ? "6px 0 0 6px" : "0 6px 6px 0",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.12s ease, color 0.12s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "var(--surface-hover)";
        el.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "var(--surface)";
        el.style.color = "var(--text-tertiary)";
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {variant === "left" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}

function SegmentedToggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", height: 34 }}>
      {options.map((o, idx) => {
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              minWidth: 64,
              padding: "0 14px",
              border: "1px solid var(--border-default)",
              background: isActive ? "var(--action)" : "var(--surface)",
              color: isActive ? "var(--text-on-primary)" : "var(--text-tertiary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: idx === 0 ? "6px 0 0 6px" : "0 6px 6px 0",
              borderLeftWidth: idx === 0 ? 1 : 0,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
