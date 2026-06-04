"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "pending" | "running" | "done" | "error";

export function RemoteSyncButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/admin/remote-sync");
      const { request } = await res.json();
      if (!request) return;

      if (request.status === "pending" || request.status === "running") {
        setStatus(request.status);
        setMessage(request.status === "pending" ? "PC 대기 중..." : "동기화 실행 중...");
      } else if (request.status === "done") {
        setStatus("done");
        setMessage(`완료 (${request.result?.files || 0}개 파일)`);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else if (request.status === "error") {
        setStatus("error");
        setMessage("실패");
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      /* ignore */
    }
  };

  const requestSync = async () => {
    try {
      const res = await fetch("/api/admin/remote-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "요청 실패");
        setStatus("error");
        return;
      }
      setStatus("pending");
      setMessage("PC 대기 중...");
      pollRef.current = setInterval(checkStatus, 5000);
    } catch {
      setStatus("error");
      setMessage("네트워크 오류");
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const isActive = status === "pending" || status === "running";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={requestSync}
        disabled={isActive}
        style={{
          padding: "8px 14px",
          borderRadius: "var(--radius-md)",
          background: isActive ? "var(--color-border)" : "linear-gradient(135deg, #059669, #34d399)",
          color: "white",
          border: "none",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          cursor: isActive ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: isActive ? "none" : "0 2px 8px rgba(5,150,105,0.3)",
        }}
        title="PC가 켜져 있으면 원격으로 동기화 실행"
      >
        {isActive ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
            />{" "}
            {message}
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12l4 4 4-4M12 8v8" />
            </svg>{" "}
            원격 동기화
          </>
        )}
      </button>
      {status === "done" && (
        <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>{message}</span>
      )}
      {status === "error" && (
        <span style={{ fontSize: 11, color: "var(--status-danger)", fontWeight: 600 }}>{message}</span>
      )}
    </div>
  );
}
