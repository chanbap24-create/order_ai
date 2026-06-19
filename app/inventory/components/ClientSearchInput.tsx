"use client";

import { useEffect, useRef, useState } from "react";

type ClientOpt = { client_code: string; client_name: string };

type Props = {
  clientName: string;
  setClientName: (v: string) => void;
  setClientCode: (v: string | null) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
  /** 'CDV' → wine, 'DL' → glass 거래처 마스터 */
  company?: string;
  width?: number | string;
};

/**
 * 거래처 마스터 검색·선택 입력.
 * 타이핑하면 /api/sales/clients 검색 드롭다운 → 선택 시 client_code 연결.
 * 그냥 입력하면 코드는 비워둔 자유 텍스트로도 동작(폴백).
 */
export function ClientSearchInput({
  clientName, setClientName, setClientCode,
  focused, setFocused, company, width = 150,
}: Props) {
  const [opts, setOpts] = useState<ClientOpt[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const runSearch = (term: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!term.trim()) { setOpts([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const type = company === "DL" ? "glass" : "wine";
        const res = await fetch(
          `/api/sales/clients?search=${encodeURIComponent(term)}&type=${type}&limit=8`,
        );
        const data = await res.json();
        const list: ClientOpt[] = (data.clients || []).map((c: ClientOpt) => ({
          client_code: c.client_code, client_name: c.client_name,
        }));
        setOpts(list);
        setOpen(list.length > 0);
      } catch { setOpts([]); }
    }, 250);
  };

  const pick = (c: ClientOpt) => {
    setClientName(c.client_name);
    setClientCode(c.client_code);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: "relative", width }}>
      <input
        type="text"
        placeholder="거래처 검색·선택"
        value={clientName}
        onChange={(e) => {
          setClientName(e.target.value);
          setClientCode(null); // 직접 수정 시 코드 연결 해제
          runSearch(e.target.value);
        }}
        onFocus={() => { setFocused(true); if (opts.length) setOpen(true); }}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontSize: 16,
          padding: "5px 10px",
          borderRadius: 8,
          border: `1.5px solid ${focused ? "var(--action)" : "var(--gray-200)"}`,
          outline: "none",
          boxShadow: focused ? "0 0 0 3px rgba(90,21,21,0.06)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: width + 40,
            maxHeight: 240,
            overflowY: "auto",
            background: "white",
            border: "1px solid var(--gray-200)",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            zIndex: 20,
          }}
        >
          {opts.map((c) => (
            <button
              key={c.client_code}
              onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                fontSize: 13,
                border: "none",
                borderBottom: "1px solid var(--gray-100)",
                background: "white",
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 600 }}>{c.client_name}</span>
              <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 11 }}>
                {c.client_code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
