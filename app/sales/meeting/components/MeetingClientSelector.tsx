"use client";

import type { useMeetingModal } from "../hooks/useMeetingModal";

type Props = {
  modal: ReturnType<typeof useMeetingModal>;
  currentManager: string;
};

/** 거래처 선택 UI (신규/기존 토글 + 검색 드롭다운) */
export function MeetingClientSelector({ modal, currentManager }: Props) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8a8580" }}>
          거래처 <span style={{ fontWeight: 400, color: "#bbb" }}>(선택)</span>
        </label>
        <button
          onClick={() => {
            modal.setNewClientMode(!modal.newClientMode);
            modal.setModalClient(null);
            modal.clientSearch.setSearch("");
            modal.setNewClientName("");
            modal.setNewClientCode("");
            modal.setNewClientCodeError("");
            modal.clientSearch.setShowDropdown(false);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: modal.newClientMode ? "#dc3545" : "#5A1515",
            fontWeight: 600,
          }}
        >
          {modal.newClientMode ? "기존 거래처 선택" : "+ 신규 거래처"}
        </button>
      </div>

      {modal.newClientMode ? (
        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            placeholder="거래처명"
            value={modal.newClientName}
            onChange={(e) => modal.setNewClientName(e.target.value)}
            style={{ ...INPUT, marginBottom: 8 }}
          />
          <input
            type="text"
            placeholder="거래처 코드 (있으면 입력)"
            value={modal.newClientCode}
            onChange={(e) => {
              modal.setNewClientCode(e.target.value);
              modal.setNewClientCodeError("");
            }}
            style={{ ...INPUT, color: "#666" }}
          />
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
            담당자: {currentManager || "-"} · 코드 없으면 자동 생성됩니다
          </div>
        </div>
      ) : (
        <div
          ref={modal.clientSearch.dropdownRef}
          style={{ position: "relative", marginBottom: 14 }}
        >
          <input
            type="text"
            placeholder="거래처명으로 검색..."
            value={modal.clientSearch.search}
            onChange={(e) => {
              modal.clientSearch.setSearch(e.target.value);
              modal.setModalClient(null);
            }}
            onFocus={() => {
              if (modal.clientSearch.options.length > 0)
                modal.clientSearch.setShowDropdown(true);
            }}
            style={{ ...INPUT, background: modal.modalClient ? "#f8f6f0" : "#fff" }}
          />
          {modal.modalClient && (
            <button
              onClick={() => {
                modal.setModalClient(null);
                modal.clientSearch.setSearch("");
              }}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                color: "#a8a098",
              }}
            >
              ×
            </button>
          )}
          {modal.clientSearch.showDropdown && modal.clientSearch.options.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid rgba(90,21,21,0.08)",
                borderRadius: "0 0 8px 8px",
                maxHeight: 200,
                overflowY: "auto",
                zIndex: 100,
                boxShadow: "0 4px 12px rgba(90,21,21,0.08)",
              }}
            >
              {modal.clientSearch.options.map((c) => (
                <div
                  key={c.client_code}
                  onClick={() => {
                    modal.setModalClient(c);
                    modal.clientSearch.setSearch(c.client_name);
                    modal.clientSearch.setShowDropdown(false);
                  }}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f5f3ed",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.client_name}</div>
                  <div style={{ fontSize: 11, color: "#a8a098" }}>
                    {c.client_code}
                    {c.manager && ` · ${c.manager}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(90,21,21,0.08)",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
};
