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
 * 주간 리스트 — KREAM 스타일 연속 리스트.
 * 박스 없이 날짜 = 볼드 섹션 헤더, 미팅 = 헤어라인 행.
 * 오늘은 블랙 강조 + TODAY 칩, 휴일은 빨간 텍스트, 과거는 muted.
 */
export function WeekList(p: Props) {
  return (
    <div>
      {p.rangeDates.map((dateStr) => {
        const dayMeetings = p.meetingsByDate[dateStr] || [];
        const isToday = dateStr === p.todayStr;
        const isPast = dateStr < p.todayStr;
        const holidayName = p.holidays[dateStr];
        const isHoliday = !!holidayName;

        return (
          <section key={dateStr} style={{ opacity: isPast ? 0.55 : 1 }}>
            {/* 날짜 = 섹션 헤더 (박스 아님) */}
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 0 10px",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    color: isHoliday
                      ? "var(--status-danger)"
                      : "var(--text-primary)",
                  }}
                >
                  {formatDateKR(dateStr)}
                </span>
                {isToday && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
                    padding: "2px 7px", borderRadius: 4,
                    background: "var(--text-primary)", color: "#fff",
                  }}>
                    TODAY
                  </span>
                )}
                {isHoliday && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--status-danger)" }}>
                    {holidayName}
                  </span>
                )}
                {dayMeetings.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {dayMeetings.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => p.onCreateMeeting(dateStr)}
                title="미팅 추가"
                style={{
                  width: 26, height: 26,
                  border: "none", background: "transparent",
                  color: "var(--text-muted)", borderRadius: 6,
                  cursor: "pointer", fontSize: 17, fontWeight: 500, lineHeight: 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.12s ease, background 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "var(--text-primary)"; b.style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "var(--text-muted)"; b.style.background = "transparent";
                }}
              >
                +
              </button>
            </header>

            {dayMeetings.length === 0 ? (
              <div style={{ padding: "14px 0", color: "var(--text-muted)", fontSize: 12 }}>
                미팅 없음
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {dayMeetings.map((m) => (
                  <MeetingRow key={m.id} meeting={m} onClick={() => p.onOpenMeeting(m)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Chip({
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
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function MeetingRow({
  meeting,
  onClick,
}: {
  meeting: Meeting;
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
        padding: "13px 0",
        cursor: "pointer",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLLIElement).style.background = "var(--surface-hover)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLLIElement).style.background = "transparent")
      }
    >
      {/* 시간 — 블랙 볼드 tabular (KREAM 숫자 위계) */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 700,
          color: meeting.meeting_time ? "var(--text-primary)" : "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {meeting.meeting_time || "--:--"}
        {hasReminder && <span style={{ fontSize: 9, marginLeft: 3 }}>🔔</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          {meeting.client_name}
        </span>
        <Chip bg={imp.color} color="#fff">{imp.label}</Chip>
        <Chip bg={`${mt.color}18`} color={mt.color}>{mt.label}</Chip>
        <Chip bg={st.bg} color={st.color}>{st.label}</Chip>
        {meeting.purpose && (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "40%",
            }}
          >
            {meeting.purpose}
          </span>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        {meeting.ai_briefing ? (
          <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700 }}>브리핑 ✓</span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
        )}
      </div>
    </li>
  );
}
