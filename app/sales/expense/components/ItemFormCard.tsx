"use client";

import type { useItemForm } from "../hooks/useItemForm";
import { ACCOUNT_CATEGORIES } from "../constants";
import { Section } from "@/app/components/ui";
import {
  inputStyle,
  selectStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
} from "@/app/styles/controls";

type Props = {
  form: ReturnType<typeof useItemForm>;
};

/**
 * 경비 항목 입력 폼.
 * - 헤더: 모드 라벨 + 신뢰도 pill (한 줄)
 * - 폼: 2 컬럼 grid (사용일/계정과목 / 사용내역(전폭) / 금액/비고 / 운행거리(조건부))
 * - 액션: 항목 추가 (primary) + 직접 입력 (secondary)
 */
export function ItemFormCard({ form }: Props) {
  const isParse = !!form.parseResult;
  const confidence = form.parseResult?.confidence ?? 0;
  const confHigh = confidence >= 0.8;

  return (
    <Section padding="md">
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}
        >
          {isParse ? "파싱 결과 확인" : "직접 입력"}
        </span>
        {isParse && (
          <ConfidencePill confidence={confidence} high={confHigh} />
        )}
      </div>

      {/* 폼 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <Field label="사용일자">
          <input
            type="date"
            value={form.editDate}
            onChange={(e) => form.setEditDate(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="계정과목">
          <select
            value={form.editCategory}
            onChange={(e) => form.setEditCategory(e.target.value)}
            style={selectStyle}
          >
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="사용내역" colSpanFull>
          <input
            type="text"
            value={form.editDesc}
            onChange={(e) => form.setEditDesc(e.target.value)}
            placeholder="상호명 / 내용"
            style={inputStyle}
          />
        </Field>

        <Field label="금액">
          <input
            type="text"
            inputMode="numeric"
            value={form.editAmount}
            onChange={(e) =>
              form.setEditAmount(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="0"
            style={{
              ...inputStyle,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          />
          {form.editAmount && (
            <HelperText right>
              {Number(form.editAmount).toLocaleString()}원
            </HelperText>
          )}
        </Field>

        <Field label="비고">
          <input
            type="text"
            value={form.editNote}
            onChange={(e) => form.setEditNote(e.target.value)}
            placeholder="선택사항"
            style={inputStyle}
          />
        </Field>

        {form.editCategory === "차량유지비" && (
          <Field label="운행거리 (KM)" colSpanFull>
            <input
              type="text"
              inputMode="numeric"
              value={form.editKm}
              onChange={(e) =>
                form.setEditKm(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="0"
              style={{
                ...inputStyle,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            {form.editKm && (
              <HelperText right>
                {Number(form.editKm).toLocaleString()}km
              </HelperText>
            )}
          </Field>
        )}
      </div>

      {/* 액션 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <button onClick={form.startManualEntry} style={btnSecondary}>
          직접 입력
        </button>
        <button onClick={form.addItem} style={btnPrimary}>
          + 항목 추가
        </button>
      </div>
    </Section>
  );
}

function Field({
  label,
  colSpanFull,
  children,
}: {
  label: string;
  colSpanFull?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={colSpanFull ? { gridColumn: "1 / -1" } : undefined}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function HelperText({
  right,
  children,
}: {
  right?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--text-tertiary)",
        marginTop: 4,
        textAlign: right ? "right" : "left",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </div>
  );
}

function ConfidencePill({
  confidence,
  high,
}: {
  confidence: number;
  high: boolean;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 4,
        background: high ? "#dcfce7" : "#fef3c7",
        color: high ? "#15803d" : "#92400e",
        letterSpacing: "0.04em",
      }}
    >
      신뢰도 {Math.round(confidence * 100)}%
      {!high && " · 확인 필요"}
    </span>
  );
}
