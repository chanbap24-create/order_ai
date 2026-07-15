"use client";

type Props = {
  search: string;
  onSearch: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
  /** 현재 목록(날짜 필터 적용) 건수 — 일괄 삭제 확인 문구용 */
  count: number;
  /** 날짜 일괄 삭제 실행 — 반환값으로 결과 알림 */
  onDeleteDate: () => Promise<{ deleted: number; stepup_released: number } | null>;
};

/** 저장 견적 검색바 — 거래처명 검색 + 발행일(날짜) 필터 + 해당 날짜 일괄 삭제 */
export function SavedQuotesFilterBar({ search, onSearch, date, onDate, count, onDeleteDate }: Props) {
  const handleDelete = async () => {
    if (count === 0) return;
    if (!confirm(
      `${date}에 발행된 견적 ${count}건을 모두 삭제할까요?\n\n` +
      `삭제는 복구할 수 없습니다. (이번 분기 보정 견적이 포함되면 해당 거래처의 보정 기회는 되살아납니다)`,
    )) return;
    const r = await onDeleteDate();
    if (r) {
      alert(`${r.deleted}건 삭제됨${r.stepup_released ? ` · 하위거래처 보정 락 ${r.stepup_released}곳 해제` : ""}`);
    } else {
      alert("일괄 삭제에 실패했습니다.");
    }
  };

  return (
    <div style={{ padding: "0 4px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="거래처명 검색…"
          style={{ ...inp, flex: 1 }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          title="발행일로 필터 (KST)"
          style={{ ...inp, width: 150, fontSize: 16 }}
        />
      </div>
      {date && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "7px 10px", borderRadius: 8, background: "var(--surface-muted, #f6f4f2)",
          border: "1px solid var(--border-default)", fontSize: 12,
        }}>
          <span style={{ color: "var(--text-secondary)" }}>
            <b style={{ color: "var(--text-primary)" }}>{date}</b> 발행 견적 <b style={{ color: "var(--text-primary)" }}>{count}건</b>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onDate("")} style={btnGhost}>필터 해제</button>
            <button onClick={handleDelete} disabled={count === 0} style={{ ...btnDanger, opacity: count === 0 ? 0.5 : 1 }}>
              이 날짜 견적 모두 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid var(--gray-300)", borderRadius: 8,
  fontSize: 14, boxSizing: "border-box", background: "#fff", color: "var(--text-primary)",
};
const btnGhost: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
  border: "1px solid var(--gray-200)", background: "white", color: "var(--text-secondary)",
};
const btnDanger: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
  border: "1px solid var(--status-danger)", background: "var(--status-danger)", color: "#fff",
};
