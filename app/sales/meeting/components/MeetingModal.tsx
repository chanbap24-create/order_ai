"use client";

import type { useMeetingModal } from "../hooks/useMeetingModal";
import { MEETING_TYPES, REMINDER_OPTIONS } from "../constants";
import { MeetingClientSelector } from "./MeetingClientSelector";
import { TimePicker } from "./TimePicker";

type Props = {
  modal: ReturnType<typeof useMeetingModal>;
  currentManager: string;
};

/** 미팅 생성/수정 모달 */
export function MeetingModal({ modal, currentManager }: Props) {
  if (!modal.showModal) return null;

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
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => modal.setShowModal(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "24px 20px",
          width: "100%",
          maxWidth: 400,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
          {modal.editingId ? "일정 수정" : "일정 추가"}
        </div>

        <Label>제목</Label>
        <input
          type="text"
          placeholder="예: 주간 회의, 와인 시음회..."
          value={modal.modalTitle}
          onChange={(e) => modal.setModalTitle(e.target.value)}
          style={{ ...INPUT, marginBottom: 14 }}
        />

        <MeetingClientSelector modal={modal} currentManager={currentManager} />

        <Label>날짜</Label>
        <input
          type="date"
          value={modal.modalDate}
          onChange={(e) => modal.setModalDate(e.target.value)}
          style={{ ...INPUT, marginBottom: 14 }}
        />

        <Label>시간</Label>
        <TimePicker value={modal.modalTime} onChange={modal.setModalTime} />

        <Label>미팅 타입</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {Object.entries(MEETING_TYPES).map(([key, { label, color }]) => (
            <button
              key={key}
              onClick={() => modal.setModalType(key)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 8,
                border: "none",
                background: modal.modalType === key ? `${color}20` : "var(--surface-muted)",
                color: modal.modalType === key ? color : "var(--neutral-100)",
                fontWeight: modal.modalType === key ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                outline: modal.modalType === key ? `2px solid ${color}` : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <Label>목적/메모</Label>
        <textarea
          value={modal.modalPurpose}
          onChange={(e) => modal.setModalPurpose(e.target.value)}
          placeholder="미팅 목적..."
          rows={3}
          style={{ ...INPUT, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
        />

        <Label>알람</Label>
        <select
          value={modal.modalReminder === null ? "default" : String(modal.modalReminder)}
          onChange={(e) => {
            const v = e.target.value;
            modal.setModalReminder(v === "default" ? null : Number(v));
          }}
          style={{ ...INPUT, marginBottom: 20, background: "#fff", color: "var(--text-primary)" }}
        >
          {REMINDER_OPTIONS.map((opt) => (
            <option
              key={opt.value === null ? "default" : opt.value}
              value={opt.value === null ? "default" : opt.value}
            >
              {opt.label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => modal.setShowModal(false)}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "#fff",
              color: "var(--text-tertiary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            onClick={modal.saveMeeting}
            disabled={(modal.newClientMode && !modal.newClientName.trim()) || modal.modalSaving}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background:
                (modal.newClientMode && !modal.newClientName.trim()) || modal.modalSaving
                  ? "var(--gray-300)"
                  : "var(--action)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor:
                (modal.newClientMode && !modal.newClientName.trim()) || modal.modalSaving
                  ? "default"
                  : "pointer",
            }}
          >
            {modal.modalSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-tertiary)",
        display: "block",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
};
