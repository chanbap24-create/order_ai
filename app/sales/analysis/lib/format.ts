export function fmt(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (n >= 1e4) return (n / 1e4).toFixed(0) + "만";
  return n.toLocaleString();
}

export function fmtFull(n: number): string {
  return n.toLocaleString() + "원";
}

/** 프리셋 이름으로부터 start/end 날짜 계산 (KST) */
export function computePresetRange(preset: string): { start: string; end: string } | null {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "this_month":
      return {
        start: `${y}-${String(m + 1).padStart(2, "0")}-01`,
        end: now.toISOString().slice(0, 10),
      };
    case "last_month": {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      const lastDay = new Date(py, pm + 1, 0).getDate();
      return {
        start: `${py}-${String(pm + 1).padStart(2, "0")}-01`,
        end: `${py}-${String(pm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    case "recent_3m": {
      const d3 = new Date(y, m - 2, 1);
      return {
        start: `${d3.getFullYear()}-${String(d3.getMonth() + 1).padStart(2, "0")}-01`,
        end: now.toISOString().slice(0, 10),
      };
    }
    case "this_year":
      return { start: `${y}-01-01`, end: now.toISOString().slice(0, 10) };
    case "last_year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default:
      return null;
  }
}
