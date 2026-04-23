"use client";

import type React from "react";
import type { MeetingReminder } from "../../types";
import { MEETING_TYPE_LABEL } from "../../constants";
import { importanceStars } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";

type Props = {
  items: MeetingReminder[];
  count: number;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function MeetingSection(p: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="미팅 리마인더"
        titleColor="#6A1B9A"
        count={p.count}
        collapsed={p.collapsed}
        onToggle={() => p.setCollapsed(!p.collapsed)}
      />

      {!p.collapsed && (
        <>
          {p.count === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 13 }}>
              예정된 미팅이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.items.map((m) => {
              const isToday = m.days_until === 0;
              const isTomorrow = m.days_until === 1;
              const dLabel = isToday ? "D-0 오늘" : isTomorrow ? "D-1 내일" : `D-${m.days_until}`;

              return (
                <div
                  key={m.meeting_id}
                  style={{
                    background: isToday ? "#FFF8E1" : "white",
                    borderRadius: 12,
                    borderLeft: `4px solid ${isToday ? "#c62828" : "#6A1B9A"}`,
                    boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                    padding: "14px 16px",
                    position: "relative",
                  }}
                >
                  <DismissButton onDismiss={(e) => p.dismissItem(`meeting_${m.meeting_id}`, e)} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingRight: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isToday ? "#FFEBEE" : isTomorrow ? "#FFF3E0" : "#F3E5F5",
                          color: isToday ? "#c62828" : isTomorrow ? "#E65100" : "#6A1B9A",
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {dLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#2c1810",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.client_name}
                      </span>
                    </div>
                    {m.importance != null && m.importance >= 1 && m.importance <= 5 && (
                      <span style={{ fontSize: 12, color: "#F59E0B", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8 }}>
                        {importanceStars(m.importance)}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: "#8a8580", marginBottom: 6 }}>
                    {m.meeting_date} {m.meeting_time ? m.meeting_time : ""}
                    <span style={{ margin: "0 6px", color: "#ddd" }}>|</span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "#F3E5F5",
                        color: "#6A1B9A",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {MEETING_TYPE_LABEL[m.meeting_type] || m.meeting_type}
                    </span>
                  </div>

                  {m.purpose && (
                    <div style={{ fontSize: 12, color: "#8a8580", marginBottom: 6 }}>
                      {m.purpose}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: m.briefing_ready ? "#E8F5E9" : "#faf9f7",
                        color: m.briefing_ready ? "#2E7D32" : "#999",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {m.briefing_ready ? "브리핑 준비완료" : "브리핑 미작성"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
