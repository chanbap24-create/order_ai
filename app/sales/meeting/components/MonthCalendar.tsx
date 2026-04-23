"use client";

import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting } from "../types";
import { DAYS_KR, MEETING_TYPES } from "../constants";

type Props = {
  weekGroups: string[][];
  meetings: Meeting[];
  meetingsByDate: Record<string, Meeting[]>;
  importByDate: Record<string, { brands: string[]; items: ImportScheduleItem[] }>;
  holidays: Record<string, string>;
  todayStr: string;
  onCreateMeeting: (date: string) => void;
  onOpenMeeting: (m: Meeting) => void;
  onOpenImport: (date: string) => void;
};

export function MonthCalendar(p: Props) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid rgba(90,21,21,0.06)",
        boxShadow: "0 1px 3px rgba(90,21,21,0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          borderBottom: "1px solid rgba(90,21,21,0.06)",
          background: "#faf8f2",
        }}
      >
        {DAYS_KR.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              padding: "8px 0",
              fontSize: 11,
              fontWeight: 600,
              color: day === "일" ? "#c62828" : day === "토" ? "#1565C0" : "#666",
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
            borderBottom: wi < p.weekGroups.length - 1 ? "1px solid rgba(90,21,21,0.06)" : "none",
          }}
        >
          {wi === 0 &&
            (() => {
              const firstDay = new Date(week[0] + "T00:00:00").getDay();
              return Array.from({ length: firstDay }).map((_, i) => (
                <div
                  key={`e${i}`}
                  style={{
                    borderRight: "1px solid #f8f6f0",
                    minHeight: 102,
                    background: "#fcfcfb",
                  }}
                />
              ));
            })()}

          {week.map((dateStr) => {
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

            return (
              <div
                key={dateStr}
                style={{
                  borderRight: "1px solid #f8f6f0",
                  minHeight: 102,
                  padding: "4px",
                  background: isToday
                    ? "#faf0f2"
                    : isHoliday
                      ? "#fff5f5"
                      : isPast
                        ? "#fdfcfa"
                        : "#fff",
                  cursor: "pointer",
                  overflow: "hidden",
                  minWidth: 0,
                }}
                onClick={() => p.onCreateMeeting(dateStr)}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 800 : 500,
                    color: isToday
                      ? "#fff"
                      : isSun || isHoliday
                        ? "#c62828"
                        : isSat
                          ? "#1565C0"
                          : isPast
                            ? "#bbb"
                            : "#2c1810",
                    textAlign: "center",
                    marginBottom: 2,
                    ...(isToday
                      ? {
                          background: "#5A1515",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          lineHeight: "22px",
                          margin: "0 auto 2px",
                        }
                      : {}),
                  }}
                >
                  {dayNum}
                </div>
                {isHoliday && (
                  <div
                    style={{
                      fontSize: 8,
                      color: "#c62828",
                      textAlign: "center",
                      fontWeight: 600,
                      lineHeight: 1.1,
                      marginBottom: 1,
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
                        fontSize: 9,
                        padding: "1px 3px",
                        marginBottom: 1,
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
                  <div style={{ fontSize: 9, color: "#a8a098", textAlign: "center" }}>
                    +{dayMeetings.length - 3}건
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
                      gap: 1,
                      flexWrap: "wrap",
                      marginTop: 1,
                      cursor: "pointer",
                    }}
                  >
                    {dayImport.brands.slice(0, 3).map((bc) => (
                      <span
                        key={bc}
                        style={{
                          fontSize: 8,
                          padding: "0px 3px",
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
                      <span style={{ fontSize: 8, color: "#E65100" }}>
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
                    borderRight: "1px solid #f8f6f0",
                    minHeight: 102,
                    background: "#fcfcfb",
                  }}
                />
              ));
            })()}
        </div>
      ))}

      <div
        style={{
          padding: "10px 14px",
          background: "#faf8f2",
          borderTop: "1px solid rgba(90,21,21,0.06)",
          fontSize: 12,
          color: "#8a8580",
          display: "flex",
          justifyContent: "space-between",
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
      </div>
    </div>
  );
}
