"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
 * 드롭다운은 사이드바 overflow:hidden 에 잘리지 않도록 body 포털로 띄운다(fixed 위치).
 */
export function ClientSearchInput({
  clientName, setClientName, setClientCode,
  focused, setFocused, company, width = 150,
}: Props) {
  const [opts, setOpts] = useState<ClientOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 클릭 시 닫기(입력/포털 드롭다운 둘 다 바깥일 때만)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || ddRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // 열려있는 동안 입력 위치를 추적(스크롤·리사이즈 대응)
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = boxRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

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

  const minWidth = typeof width === "number" ? width + 40 : 190;

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
          boxShadow: focused ? "0 0 0 3px rgba(0,0,0,0.06)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={ddRef}
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            minWidth,
            maxHeight: 240,
            overflowY: "auto",
            background: "white",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            zIndex: 1000,
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
                borderBottom: "1px solid var(--border-default)",
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
        </div>,
        document.body,
      )}
    </div>
  );
}
