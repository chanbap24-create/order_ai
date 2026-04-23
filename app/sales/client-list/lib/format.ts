export function fmt(n: number) { return n.toLocaleString(); }
export function fmtDate(d: string) { return d ? d.slice(0, 10) : '-'; }

function getKstNow() { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

export function getPresetRange(preset: string): [string, string] {
  const now = getKstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = toDateStr(now);

  switch (preset) {
    case 'thisMonth':
      return [`${y}-${String(m + 1).padStart(2, '0')}-01`, today];
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(Date.UTC(ly, lm + 1, 0)).getUTCDate();
      return [
        `${ly}-${String(lm + 1).padStart(2, '0')}-01`,
        `${ly}-${String(lm + 1).padStart(2, '0')}-${lastDay}`,
      ];
    }
    case 'last3Months': {
      const sm = m - 2 < 0 ? m - 2 + 12 : m - 2;
      const sy = m - 2 < 0 ? y - 1 : y;
      return [`${sy}-${String(sm + 1).padStart(2, '0')}-01`, today];
    }
    case 'thisYear':
      return [`${y}-01-01`, today];
    case 'lastYear':
      return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 'custom':
    default:
      return [`${y}-${String(m + 1).padStart(2, '0')}-01`, today];
  }
}
