"use client";

import type { Meeting } from "../types";
import { IMPORTANCE_LABELS, MEETING_TYPES, STATUS_MAP } from "../constants";
import { formatDateKR } from "../lib/format";

type Props = {
  rangeDates: string[];
  meetingsByDate: Record<string, Meeting[]>;
  holidays: Record<string, string>;
  todayStr: string;
  onCreateMeeting: (date: string) => void;
  onOpenMeeting: (m: Meeting) => void;
};

/**
 * 주간 리스트 — 카드 = 하루.
 * 모든 카드는 동일 외곽(border-default + radius 10) 사용.
 * 오늘은 좌측 강조 막대, 휴일은 부드러운 빨간 톤, 과거는 muted.
 */
export function WeekList(p: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {p.rangeDates.map((dateStr) => {
        const dayMeetings = p.meetingsByDate[dateStr] || [];
        const isToday = dateStr === p.todayStr;
        const isPast = dateStr < p.todayStr;
        const holidayName = p.holidays[dateStr];
        const isHoliday = !!holidayName;

        return (
          <div
            key={dateStr}
            style={{
              background: "var(--surface)",
              borderRadius: 10,
              border: "1px solid var(--border-default)",
              borderLeft: isToday
                ? "3px solid var(--action)"
                : "1px solid var(--border-default)",
              overflow: "hidden",
              opacity: isPast ? 0.7 : 1,
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                background: isToday
                  ? "var(--surface-active)"
                  : isHoliday
                    ? "#fff5f5"
                    : "var(--surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isHoliday
                      ? "var(--status-danger)"
                      : isToday
                        ? "var(--action)"
                        : "var(--text-primary)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {formatDateKR(dateStr)}
                </span>
                {isHoliday && <Pill bg="var(--status-danger-bg)" color="var(--status-danger)">{holidayName}</Pill>}
                {isToday && <Pill bg="var(--action)" color="var(--text-on-primary)">TODAY</Pill>}
                {dayMeetings.length > 0 && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {dayMeetings.length}건
                  </span>
                )}
              </div>
              <button
                onClick={() => p.onCreateMeeting(dateStr)}
                title="미팅 추가"
                style={{
                  width: 28,
                  height: 28,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface)",
                  color: "var(--action)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </button>
            </header>

            {dayMeetings.length === 0 ? (
              <div
                style={{
                  padding: "16px 16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                미팅 없음
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {dayMeetings.map((m, i) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    isLast={i === dayMeetings.length - 1}
                    onClick={() => p.onOpenMeeting(m)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Pill({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 4,
        background: bg,
        color,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

function MeetingRow({
  meeting,
  isLast,
  onClick,
}: {
  meeting: Meeting;
  isLast: boolean;
  onClick: () => void;
}) {
  const mt = MEETING_TYPES[meeting.meeting_type] || MEETING_TYPES.visit;
  const st = STATUS_MAP[meeting.status] || STATUS_MAP.planned;
  const imp = IMPORTANCE_LABELS[meeting.client_importance] || IMPORTANCE_LABELS[3];
  const hasReminder = meeting.meeting_time && meeting.reminder_minutes !== 0;

  return (
    <li
      onClick={onClick}
      style={{
        padding: "12px 16px",
        cursor: "pointer",
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLLIElement).style.background = "var(--surface-hover)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLLIElement).style.background = "transparent")
      }
    >
      <div
        style={{
          width: 52,
          flexShrink: 0,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--action)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {hasReminder && <div style={{ fontSize: 9, marginBottom: 2 }}>🔔</div>}
        {meeting.meeting_time || "--:--"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {meeting.client_name}
          </span>
          <Pill bg={imp.color} color="#fff">
            {imp.label}
          </Pill>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <Pill bg={`${mt.color}18`} color={mt.color}>
            {mt.label}
          </Pill>
          <Pill bg={st.bg} color={st.color}>
            {st.label}
          </Pill>
          {meeting.purpose && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {meeting.purpose}
            </span>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {meeting.ai_briefing ? (
          <span style={{ fontSize: 10, color: "var(--status-success)", fontWeight: 700 }}>브리핑 ✓</span>
        ) : (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>—</span>
        )}
      </div>
    </li>
  );
}
