"use client";

import { WINE_COLORS } from "../constants";
import { checkboxSquareStyle } from "./styles";

export type NewBusinessFormProps = {
  enabled: boolean;
  name: string;
  phone: string;
  email: string;
  setEnabled: (v: boolean) => void;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setEmail: (v: string) => void;
};

export function NewBusinessForm({
  enabled,
  name,
  phone,
  email,
  setEnabled,
  setName,
  setPhone,
  setEmail,
}: NewBusinessFormProps) {
  return (
    <>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: enabled ? `1px solid ${WINE_COLORS.dividerCard}` : "none",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={checkboxSquareStyle(enabled)}>{enabled && <Check />}</div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ display: "none" }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: WINE_COLORS.text }}>
            신규 사업자
          </span>
        </label>
      </div>

      {enabled && (
        <div style={{ padding: "16px 18px", background: WINE_COLORS.primaryBgSubtle }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field
              label="사업자명"
              required
              value={name}
              setValue={setName}
              placeholder="예: 홍길동 레스토랑"
            />
            <Field
              label="연락처"
              required
              value={phone}
              setValue={setPhone}
              placeholder="예: 010-1234-5678"
            />
            <Field
              label="세금계산서 이메일 (선택)"
              value={email}
              setValue={setEmail}
              placeholder="예: admin@company.com"
              type="email"
            />
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: WINE_COLORS.textHelper,
              background: "var(--surface-hover)",
              padding: "10px 12px",
              borderRadius: 12,
              lineHeight: 1.5,
            }}
          >
            신규 사업자는 거래처 DB에 등록되지 않은 사업자입니다. 사업자명과 연락처를 입력하면 주문서가
            생성됩니다.
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  setValue,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: WINE_COLORS.textMuted,
          display: "block",
          marginBottom: 6,
          letterSpacing: "0.03em",
        }}
      >
        {label}
        {required && <span style={{ color: WINE_COLORS.danger }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: `1.5px solid ${WINE_COLORS.primaryBorder}`,
          fontSize: 16,
          background: WINE_COLORS.surface,
          outline: "none",
        }}
      />
    </div>
  );
}

function Check() {
  return (
    <span style={{ color: WINE_COLORS.surface, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
      &#10003;
    </span>
  );
}
