"use client";

import { STORAGE_KEYS, WINE_COLORS } from "../constants";
import {
  inputBaseStyle,
  inputFocusHandlers,
  monoStyle,
  sectionLabelStyle,
  softCardStyle,
} from "./styles";

type Props = {
  clientInput: string;
  setClientInput: (v: string) => void;
  text: string;
  setText: (v: string) => void;
  loading: boolean;
  autoPaste: boolean;
  setAutoPaste: (v: boolean) => void;
  hasClipboard: boolean;
  data: any;
  onRun: () => void;
  onClear: () => void;
  onPasteFromClipboard: () => Promise<void>;
};

/** Wine 발주 입력 카드 (거래처 입력 + 본문 + 액션 바) */
export function OrderInputCard({
  clientInput,
  setClientInput,
  text,
  setText,
  loading,
  autoPaste,
  setAutoPaste,
  hasClipboard,
  data,
  onRun,
  onClear,
  onPasteFromClipboard,
}: Props) {
  const canClear = !(loading || (!text.trim() && !data));

  return (
    <div style={softCardStyle}>
      <div>
        <label style={{ ...sectionLabelStyle, display: "block", marginBottom: 8 }}>
          거래처
        </label>
        <input
          type="text"
          value={clientInput}
          onChange={(e) => setClientInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault();
              onRun();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault();
              onRun();
            }
          }}
          placeholder="거래처를 입력하세요"
          style={inputBaseStyle}
          onFocus={inputFocusHandlers.onFocus}
          onBlur={inputFocusHandlers.onBlur}
        />
      </div>

      <div
        style={{
          height: 1,
          background: WINE_COLORS.dividerFaint,
          margin: "16px 0",
        }}
      />

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <label style={sectionLabelStyle}>발주 내용</label>
          <AutoPasteToggle value={autoPaste} onChange={setAutoPaste} />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !loading) {
              e.preventDefault();
              onRun();
            }
          }}
          rows={8}
          placeholder="품목과 수량을 입력하세요"
          style={{
            ...inputBaseStyle,
            resize: "vertical",
            lineHeight: 1.6,
            ...monoStyle,
          }}
          onFocus={inputFocusHandlers.onFocus}
          onBlur={inputFocusHandlers.onBlur}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 14, alignItems: "center" }}>
        <button
          onClick={onRun}
          disabled={loading}
          style={{
            padding: "9px 22px",
            borderRadius: 10,
            border: "none",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            background: loading ? "rgba(90,21,21,0.6)" : WINE_COLORS.primary,
            color: WINE_COLORS.surface,
            boxShadow: loading ? "none" : WINE_COLORS.primaryShadow,
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}
        >
          {loading ? "생성중..." : "생성"}
        </button>
        <button
          onClick={onClear}
          disabled={!canClear}
          style={{
            padding: "9px 18px",
            borderRadius: 10,
            border: `1.5px solid ${WINE_COLORS.primaryBorder}`,
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: canClear ? "pointer" : "not-allowed",
            background: "transparent",
            color: canClear ? WINE_COLORS.textMuted : WINE_COLORS.textDisabled,
            whiteSpace: "nowrap",
          }}
          title="입력된 내용을 지우고 결과를 초기화합니다"
        >
          지우기
        </button>
        <div style={{ flex: 1 }} />
        <div
          role="button"
          tabIndex={-1}
          onPointerDown={async (e) => {
            e.preventDefault();
            if (loading) return;
            await onPasteFromClipboard();
          }}
          style={{
            padding: "9px 18px",
            borderRadius: 10,
            border: `1.5px solid ${
              hasClipboard ? WINE_COLORS.primaryBorderStrong : WINE_COLORS.primaryBorder
            }`,
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            background: hasClipboard ? WINE_COLORS.primaryBgLight : "transparent",
            color: hasClipboard ? WINE_COLORS.primary : WINE_COLORS.textMuted,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          붙여넣기
        </div>
      </div>
    </div>
  );
}

function AutoPasteToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault();
        const next = !value;
        onChange(next);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEYS.autoPaste, String(next));
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        userSelect: "none",
        fontSize: 12,
        color: value ? WINE_COLORS.primary : "var(--gray-400)",
        fontWeight: 500,
      }}
    >
      <div
        style={{
          width: 34,
          height: 20,
          borderRadius: 10,
          background: value ? WINE_COLORS.primary : WINE_COLORS.toggleOff,
          position: "relative",
          transition: "background 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            background: WINE_COLORS.surface,
            position: "absolute",
            top: 2,
            left: value ? 16 : 2,
            transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      </div>
      자동 붙여넣기
    </div>
  );
}
