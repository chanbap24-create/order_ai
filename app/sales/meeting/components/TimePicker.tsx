"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

/** 시/분 드롭다운 조합 타임 피커 */
export function TimePicker({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      <select
        value={value ? value.split(":")[0] : ""}
        onChange={(e) => {
          const hh = e.target.value;
          const mm = value ? value.split(":")[1] || "00" : "00";
          onChange(hh ? `${hh}:${mm}` : "");
        }}
        style={SELECT}
      >
        <option value="">시</option>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <select
        value={value ? value.split(":")[1] || "00" : ""}
        onChange={(e) => {
          const hh = value ? value.split(":")[0] || "09" : "09";
          const mm = e.target.value;
          onChange(mm ? `${hh}:${mm}` : "");
        }}
        style={SELECT}
      >
        <option value="">분</option>
        {["00", "10", "20", "30", "40", "50"].map((m) => (
          <option key={m} value={m}>
            {m}분
          </option>
        ))}
      </select>
    </div>
  );
}

const SELECT: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  fontSize: 16,
  outline: "none",
  background: "#fff",
};
