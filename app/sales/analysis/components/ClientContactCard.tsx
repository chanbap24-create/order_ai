"use client";

import type { ClientDetail } from "../types";
import { BUSINESS_TYPES } from "../constants";

type Props = {
  client: ClientDetail;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  editData: Partial<ClientDetail>;
  setEditData: (d: Partial<ClientDetail>) => void;
  onSave: () => void;
};

export function ClientContactCard(p: Props) {
  const c = p.client;

  const renderEditField = (label: string, field: keyof ClientDetail) => (
    <div>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={(p.editData[field] as string) ?? (c[field] as string | null) ?? ""}
        onChange={(e) => p.setEditData({ ...p.editData, [field]: e.target.value })}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1.5px solid var(--border-default)",
          fontSize: 16,
        }}
      />
    </div>
  );

  const renderInfoField = (label: string, value: string | null | undefined) => (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 14, color: value ? "var(--neutral-700)" : "var(--gray-300)" }}>{value || "-"}</div>
    </div>
  );

  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        padding: "12px 20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
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
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>연락처 정보</div>
        <button
          onClick={() => {
            p.setEditMode(!p.editMode);
            p.setEditData({});
          }}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: "1.5px solid var(--border-default)",
            background: p.editMode ? "var(--action)" : "white",
            color: p.editMode ? "white" : "var(--neutral-400)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {p.editMode ? "취소" : "편집"}
        </button>
      </div>
      {p.editMode ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {renderEditField("담당자", "contact_name")}
          {renderEditField("전화번호", "contact_phone")}
          {renderEditField("이메일", "contact_email")}
          {renderEditField("주소", "address")}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              업종
            </label>
            <select
              value={p.editData.business_type ?? c.business_type ?? ""}
              onChange={(e) => p.setEditData({ ...p.editData, business_type: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1.5px solid var(--border-default)",
                fontSize: 16,
                background: "white",
              }}
            >
              <option value="">선택</option>
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
          {renderEditField("담당자(우리)", "manager")}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              메모
            </label>
            <textarea
              value={p.editData.memo ?? c.memo ?? ""}
              onChange={(e) => p.setEditData({ ...p.editData, memo: e.target.value })}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1.5px solid var(--border-default)",
                fontSize: 16,
                resize: "vertical",
              }}
            />
          </div>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={p.onSave}
              style={{
                padding: "8px 24px",
                borderRadius: 6,
                border: "none",
                background: "var(--action)",
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
          {renderInfoField("담당자", c.contact_name)}
          {renderInfoField("전화번호", c.contact_phone)}
          {renderInfoField("이메일", c.contact_email)}
          {renderInfoField("주소", c.address)}
          {renderInfoField("업종", c.business_type)}
          {renderInfoField("담당자(우리)", c.manager)}
          <div style={{ gridColumn: "1 / -1" }}>{renderInfoField("메모", c.memo)}</div>
        </div>
      )}
    </div>
  );
}
