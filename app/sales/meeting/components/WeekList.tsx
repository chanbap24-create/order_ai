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
              background: "#fff",
              borderRadius: 12,
              border: isToday
                ? "2px solid #5A1515"
                : isHoliday
                  ? "1px solid #ffcdd2"
                  : "1px solid rgba(90,21,21,0.06)",
              boxShadow: isToday
                ? "0 2px 8px rgba(90,21,21,0.12)"
                : "0 1px 3px rgba(90,21,21,0.03)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: isToday ? "#faf0f2" : isHoliday ? "#fff5f5" : isPast ? "#fafafa" : "#fff",
                borderBottom: "1px solid rgba(90,21,21,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isToday
                      ? "#5A1515"
                      : isHoliday
                        ? "#c62828"
                        : isPast
                          ? "#aaa"
                          : "#2c1810",
                  }}
                >
                  {formatDateKR(dateStr)}
                </span>
                {isHoliday && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 8,
                      background: "#ffebee",
                      color: "#c62828",
                      fontWeight: 600,
                    }}
                  >
                    {holidayName}
                  </span>
                )}
                {isToday && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 8,
                      background: "#5A1515",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    TODAY
                  </span>
                )}
                {dayMeetings.length > 0 && (
                  <span style={{ fontSize: 11, color: "#a8a098" }}>{dayMeetings.length}건</span>
                )}
              </div>
              <button
                onClick={() => p.onCreateMeeting(dateStr)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#5A1515",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                +
              </button>
            </div>

            {dayMeetings.length === 0 ? (
              <div style={{ padding: "16px 14px", textAlign: "center", color: "#ccc", fontSize: 13 }}>
                미팅 없음
              </div>
            ) : (
              <div>
                {dayMeetings.map((m) => {
                  const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
                  const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
                  const imp =
                    IMPORTANCE_LABELS[m.client_importance] || IMPORTANCE_LABELS[3];
                  const hasReminder = m.meeting_time && m.reminder_minutes !== 0;

                  return (
                    <div
                      key={m.id}
                      onClick={() => p.onOpenMeeting(m)}
                      style={{
                        padding: "12px 14px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f8f6f0",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "background 0.15s",
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          flexShrink: 0,
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#5A1515",
                        }}
                      >
                        {hasReminder && <span style={{ fontSize: 10 }}>🔔</span>}
                        {m.meeting_time || "--:--"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 3,
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#2c1810" }}>
                            {m.client_name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 6,
                              background: imp.color,
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          >
                            {imp.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 8,
                              background: `${mt.color}18`,
                              color: mt.color,
                              fontWeight: 600,
                            }}
                          >
                            {mt.label}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 8,
                              background: st.bg,
                              color: st.color,
                              fontWeight: 600,
                            }}
                          >
                            {st.label}
                          </span>
                          {m.purpose && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#a8a098",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {m.purpose}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {m.ai_briefing ? (
                          <span style={{ fontSize: 10, color: "#4CAF50", fontWeight: 600 }}>
                            브리핑O
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "#ccc" }}>브리핑-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
