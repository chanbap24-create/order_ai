"use client";

import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting } from "../types";
import type { CollMarker } from "../hooks/useCollectionMarkers";
import { DAYS_KR, MEETING_TYPES } from "../constants";

type Props = {
  weekGroups: string[][];
  meetings: Meeting[];
  meetingsByDate: Record<string, Meeting[]>;
  importByDate: Record<string, { brands: string[]; items: ImportScheduleItem[] }>;
  collectionByDate?: Record<string, CollMarker[]>;
  holidays: Record<string, string>;
  todayStr: string;
  onCreateMeeting: (date: string) => void;
  onOpenMeeting: (m: Meeting) => void;
  onOpenImport: (date: string) => void;
};

/**
 * 월간 캘린더. 7x N grid.
 * 색·border 모두 의미 토큰 사용. 일요일·휴일은 빨강, 토요일은 파랑 (도메인 규칙).
 */
export function MonthCalendar(p: Props) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--surface)",
        borderRadius: 10,
        border: "1px solid var(--border-default)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--surface-muted)",
        }}
      >
        {DAYS_KR.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              padding: "10px 0",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: day === "일" ? "#c62828" : day === "토" ? "#1565C0" : "var(--text-tertiary)",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {p.weekGroups.map((week, wi) => (
        <div
          key={wi}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            borderBottom:
              wi < p.weekGroups.length - 1 ? "1px solid var(--border-subtle)" : "none",
          }}
        >
          {wi === 0 &&
            (() => {
              const firstDay = new Date(week[0] + "T00:00:00").getDay();
              return Array.from({ length: firstDay }).map((_, i) => (
                <div
                  key={`e${i}`}
                  style={{
                    borderRight: "1px solid var(--border-subtle)",
                    minHeight: 108,
                    background: "var(--surface-muted)",
                  }}
                />
              ));
            })()}

          {week.map((dateStr, di) => {
            const dayMeetings = p.meetingsByDate[dateStr] || [];
            const isToday = dateStr === p.todayStr;
            const isPast = dateStr < p.todayStr;
            const d = new Date(dateStr + "T00:00:00");
            const dayNum = d.getDate();
            const isSun = d.getDay() === 0;
            const isSat = d.getDay() === 6;
            const holidayName = p.holidays[dateStr];
            const isHoliday = !!holidayName;
            const dayImport = p.importByDate[dateStr];
            const dayColl = p.collectionByDate?.[dateStr];

            return (
              <div
                key={dateStr}
                style={{
                  borderRight:
                    di < week.length - 1 || wi === p.weekGroups.length - 1
                      ? "1px solid var(--border-subtle)"
                      : "none",
                  minHeight: 108,
                  padding: 6,
                  background: isToday
                    ? "var(--surface-active)"
                    : isHoliday
                      ? "#fff8f8"
                      : "var(--surface)",
                  cursor: "pointer",
                  overflow: "hidden",
                  minWidth: 0,
                  opacity: isPast && !isToday ? 0.75 : 1,
                }}
                onClick={() => p.onCreateMeeting(dateStr)}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 800 : 600,
                    color: isToday
                      ? "var(--text-on-primary)"
                      : isSun || isHoliday
                        ? "#c62828"
                        : isSat
                          ? "#1565C0"
                          : "var(--text-primary)",
                    textAlign: "center",
                    marginBottom: 3,
                    ...(isToday
                      ? {
                          background: "var(--action)",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          lineHeight: "22px",
                          margin: "0 auto 3px",
                        }
                      : {}),
                  }}
                >
                  {dayNum}
                </div>
                {isHoliday && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "#c62828",
                      textAlign: "center",
                      fontWeight: 600,
                      lineHeight: 1.1,
                      marginBottom: 2,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {holidayName}
                  </div>
                )}

                {dayMeetings.slice(0, 3).map((m) => {
                  const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
                  const hasReminder = m.meeting_time && m.reminder_minutes !== 0;
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        p.onOpenMeeting(m);
                      }}
                      style={{
                        fontSize: 10,
                        padding: "2px 4px",
                        marginBottom: 2,
                        borderRadius: 3,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        background: `${mt.color}18`,
                        color: mt.color,
                        fontWeight: 600,
                        cursor: "pointer",
                        maxWidth: "100%",
                      }}
                    >
                      {hasReminder && <span style={{ fontSize: 8, marginRight: 1 }}>🔔</span>}
                      {m.meeting_time?.slice(0, 5) || ""} {m.client_name}
                    </div>
                  );
                })}
                {dayMeetings.length > 3 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    +{dayMeetings.length - 3}건
                  </div>
                )}

                {dayColl && dayColl.length > 0 && (
                  <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                    {dayColl.slice(0, 2).map((c, i) => {
                      const isPromise = c.kind === "promise";
                      return (
                        <div
                          key={`${c.client_code}_${i}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`수금 ${c.amount.toLocaleString()}원`}
                          style={{
                            fontSize: 9,
                            padding: "1px 4px",
                            borderRadius: 3,
                            fontWeight: 700,
                            background: isPromise ? "#E3F2FD" : "#FDECEA",
                            color: isPromise ? "#1565C0" : "#c62828",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          💰{c.special ? "★" : ""} {c.client_name}
                        </div>
                      );
                    })}
                    {dayColl.length > 2 && (
                      <span style={{ fontSize: 9, color: "#c62828", fontWeight: 600 }}>+{dayColl.length - 2}</span>
                    )}
                  </div>
                )}

                {dayImport && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onOpenImport(dateStr);
                    }}
                    style={{
                      display: "flex",
                      gap: 2,
                      flexWrap: "wrap",
                      marginTop: 2,
                      cursor: "pointer",
                    }}
                  >
                    {dayImport.brands.slice(0, 3).map((bc) => (
                      <span
                        key={bc}
                        style={{
                          fontSize: 9,
                          padding: "1px 4px",
                          borderRadius: 3,
                          background: "#FFF3E0",
                          color: "#E65100",
                          fontWeight: 700,
                        }}
                      >
                        {bc}
                      </span>
                    ))}
                    {dayImport.brands.length > 3 && (
                      <span style={{ fontSize: 9, color: "#E65100", fontWeight: 600 }}>
                        +{dayImport.brands.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {wi === p.weekGroups.length - 1 &&
            (() => {
              const lastDay = new Date(week[week.length - 1] + "T00:00:00").getDay();
              const emptyCount = 6 - lastDay;
              return Array.from({ length: emptyCount }).map((_, i) => (
                <div
                  key={`le${i}`}
                  style={{
                    minHeight: 108,
                    background: "var(--surface-muted)",
                  }}
                />
              ));
            })()}
        </div>
      ))}

      <footer
        style={{
          padding: "10px 16px",
          background: "var(--surface-muted)",
          borderTop: "1px solid var(--border-default)",
          fontSize: 11,
          color: "var(--text-tertiary)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          letterSpacing: "0.02em",
        }}
      >
        <span>총 {p.meetings.length}건의 미팅</span>
        <span>
          {Object.values(MEETING_TYPES)
            .map((mt) => {
              const cnt = p.meetings.filter(
                (m) => MEETING_TYPES[m.meeting_type]?.label === mt.label,
              ).length;
              return cnt > 0 ? `${mt.label} ${cnt}` : null;
            })
            .filter(Boolean)
            .join(" · ")}
        </span>
      </footer>
    </div>
  );
}
