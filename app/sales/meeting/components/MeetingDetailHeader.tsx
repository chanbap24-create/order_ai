"use client";

import type { Meeting } from "../types";
import { IMPORTANCE_LABELS, MEETING_TYPES, STATUS_MAP, STATUS_FLOW } from "../constants";
import { formatDateKR } from "../lib/format";

type Props = {
  meeting: Meeting;
  onChangeStatus: (m: Meeting, s: string) => void;
  onEdit: (m: Meeting) => void;
  onDelete: (id: number) => void;
  onOpenGoogleCal: () => void;
};

export function MeetingDetailHeader(p: Props) {
  const m = p.meeting;

  return (
    <>
      <div
        style={{
          background: "linear-gradient(135deg, #5A1515, #8B2252)",
          borderRadius: 12,
          padding: 16,
          color: "#fff",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{m.client_name}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {m.client_business_type || "업종 미설정"}
              {m.client_manager && ` · ${m.client_manager}`}
            </div>
          </div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.2)",
              fontSize: 12,
            }}
          >
            {IMPORTANCE_LABELS[m.client_importance]?.label || "일반"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          <Info label="날짜" value={formatDateKR(m.meeting_date)} />
          <Info label="시간" value={m.meeting_time || "--:--"} />
          <Info
            label="타입"
            value={MEETING_TYPES[m.meeting_type]?.label || m.meeting_type}
          />
          <Info label="상태" value={STATUS_MAP[m.status]?.label || m.status} />
        </div>
        {m.purpose && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, fontStyle: "italic" }}>
            {m.purpose}
          </div>
        )}
      </div>

      {m.is_company_event ? (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            background: "#FFF8E1",
            border: "1px solid #FFE082",
            fontSize: 12,
            color: "#F57F17",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          회사 일정 (읽기 전용)
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {STATUS_FLOW.map((s) => {
            const sm = STATUS_MAP[s];
            const isCurrent = m.status === s;
            return (
              <button
                key={s}
                onClick={() => !isCurrent && p.onChangeStatus(m, s)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 8,
                  border: isCurrent ? `2px solid ${sm.color}` : "1px solid rgba(90,21,21,0.08)",
                  background: isCurrent ? sm.bg : "#fff",
                  color: isCurrent ? sm.color : "#999",
                  fontWeight: isCurrent ? 700 : 500,
                  fontSize: 12,
                  cursor: isCurrent ? "default" : "pointer",
                }}
              >
                {sm.label}
              </button>
            );
          })}
          <button
            onClick={() => p.onEdit(m)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(90,21,21,0.15)",
              background: "#fff",
              color: "var(--action)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            수정
          </button>
          <button
            onClick={() => p.onDelete(m.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ffcdd2",
              background: "#fff",
              color: "#c62828",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            삭제
          </button>
        </div>
      )}

      <button
        onClick={p.onOpenGoogleCal}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 8,
          border: "none",
          background: "#4285F4",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#fff" strokeWidth="2" />
          <path d="M3 10h18" stroke="#fff" strokeWidth="2" />
          <path d="M8 2v4M16 2v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <rect x="7" y="13" width="4" height="4" rx="0.5" fill="#fff" />
        </svg>
        캘린더에 추가
      </button>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
