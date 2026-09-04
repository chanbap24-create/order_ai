// 단일 품목 테이스팅 노트 PDF 조회 — GitHub release(note 태그)의 {품번}.pdf 자산.
// 정확 품번 우선, 없으면 같은 와인 다른 빈티지(품번 베이스 일치) 중 최신 품번으로 폴백.
const BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const INDEX_URL = `${BASE_URL}/tasting-notes-index.json`;

const vintageBaseOf = (c: string) => (/^\d{7}$/.test(c) ? c.slice(0, 2) + c.slice(4) : c);

async function loadNoteIndex(): Promise<Set<string>> {
  try {
    const res = await fetch(`${INDEX_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return new Set();
    const data = await res.json();
    const s = new Set<string>();
    for (const [k, v] of Object.entries((data.notes || {}) as Record<string, { exists?: boolean }>)) {
      if (v?.exists) s.add(k);
    }
    return s;
  } catch { return new Set(); }
}

export async function fetchTastingNotePdf(itemCode: string): Promise<{ bytes: ArrayBuffer; code: string } | null> {
  const index = await loadNoteIndex();
  let code: string | null = index.has(itemCode) ? itemCode : null;
  if (!code) {
    const base = vintageBaseOf(itemCode);
    const candidates = [...index].filter((c) => c !== itemCode && vintageBaseOf(c) === base);
    code = candidates.sort().pop() ?? null; // 같은 와인이면 품번(빈티지) 큰 쪽 우선
  }
  if (!code) return null;
  const res = await fetch(`${BASE_URL}/${code}.pdf?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return { bytes: await res.arrayBuffer(), code };
}
