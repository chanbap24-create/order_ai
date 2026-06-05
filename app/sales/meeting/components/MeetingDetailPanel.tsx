"use client";

import type { Meeting } from "../types";
import type { useMeetingDetail } from "../hooks/useMeetingDetail";
import { useState } from "react";
import { buildGoogleCalendarUrl } from "../lib/googleCalendar";
import { MeetingDetailHeader } from "./MeetingDetailHeader";
import { BriefingView } from "./BriefingView";
import { QuoteColumnsMenu } from "./QuoteColumnsMenu";

type Props = {
  detail: ReturnType<typeof useMeetingDetail>;
  onEdit: (m: Meeting) => void;
  onDelete: (id: number) => void;
  quoteCols: string[];
  setQuoteCols: React.Dispatch<React.SetStateAction<string[]>>;
  onNotesSaved: () => void;
};

export function MeetingDetailPanel(p: Props) {
  const [showColSettings, setShowColSettings] = useState(false);
  const m = p.detail.detailMeeting;
  if (!m) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={p.detail.closeDetail}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "16px 16px 0 0",
          width: "100%",
          maxWidth: 600,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "20px 16px 40px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--gray-300)",
            borderRadius: 2,
            margin: "0 auto 16px",
          }}
        />

        <MeetingDetailHeader
          meeting={m}
          onChangeStatus={p.detail.changeStatus}
          onEdit={p.onEdit}
          onDelete={p.onDelete}
          onOpenGoogleCal={() => window.open(buildGoogleCalendarUrl(m), "_blank")}
        />

        <button
          onClick={() => p.detail.generateBriefing(m)}
          disabled={p.detail.briefingLoading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 8,
            border: "none",
            background: p.detail.briefingLoading
              ? "var(--gray-300)"
              : "linear-gradient(135deg, #1a237e, #4a148c)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            cursor: p.detail.briefingLoading ? "default" : "pointer",
          }}
        >
          {p.detail.briefingLoading
            ? "브리핑 생성 중..."
            : p.detail.briefing
              ? "브리핑 새로고침"
              : "AI 브리핑 생성"}
        </button>

        {p.detail.briefing && (
          <div>
            <BriefingView
              briefing={p.detail.briefing}
              selectedRecs={p.detail.selectedRecs}
              toggleRec={p.detail.toggleRec}
            />

            {p.detail.selectedRecs.size > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <QuoteColumnsMenu
                    show={showColSettings}
                    onToggle={() => setShowColSettings((v) => !v)}
                    onClose={() => setShowColSettings(false)}
                    quoteCols={p.quoteCols}
                    setQuoteCols={p.setQuoteCols}
                  />
                  <button
                    onClick={() => p.detail.createQuote(p.quoteCols)}
                    disabled={p.detail.quoteLoading}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: 10,
                      border: "none",
                      background: p.detail.quoteLoading
                        ? "var(--gray-300)"
                        : "linear-gradient(135deg, var(--action), #8B2252)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: p.detail.quoteLoading ? "default" : "pointer",
                    }}
                  >
                    {p.detail.quoteLoading
                      ? "생성 중..."
                      : `선택 ${p.detail.selectedRecs.size}개 → 견적서 생성 & 다운로드`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 메모 */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-tertiary)",
              display: "block",
              marginBottom: 6,
            }}
          >
            메모
          </label>
          <textarea
            value={p.detail.detailNotes}
            onChange={(e) => p.detail.setDetailNotes(e.target.value)}
            placeholder="미팅 메모..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              fontSize: 16,
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          {p.detail.detailNotes !== (m.notes || "") && (
            <button
              onClick={async () => {
                await fetch("/api/sales/meetings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: m.id,
                    status: m.status,
                    notes: p.detail.detailNotes,
                  }),
                });
                p.onNotesSaved();
              }}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--action)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              메모 저장
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
