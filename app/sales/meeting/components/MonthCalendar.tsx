"use client";

import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting } from "../types";
import type { CollMarker } from "../hooks/useCollectionMarkers";
import { DAYS_KR, MEETING_TYPES } from "../constants";
import { CalendarDayCell } from "./CalendarDayCell";

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

          {week.map((dateStr, di) => (
            <CalendarDayCell
              key={dateStr}
              dateStr={dateStr}
              meetings={p.meetingsByDate[dateStr] || []}
              dayImport={p.importByDate[dateStr]}
              dayColl={p.collectionByDate?.[dateStr]}
              holidayName={p.holidays[dateStr]}
              todayStr={p.todayStr}
              borderRight={di < week.length - 1 || wi === p.weekGroups.length - 1}
              onCreateMeeting={p.onCreateMeeting}
              onOpenMeeting={p.onOpenMeeting}
              onOpenImport={p.onOpenImport}
            />
          ))}

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
