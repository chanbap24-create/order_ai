// 단일 품목 테이스팅 노트 PDF 조회 — 노트 인덱스(Storage index.json, 레거시 GitHub 통합) 기반.
// 정확 품번 우선, 없으면 같은 와인 다른 빈티지(품번 베이스 일치) 중 최신 품번으로 폴백.
import { loadNoteIndex } from './noteStore';

const vintageBaseOf = (c: string) => (/^\d{7}$/.test(c) ? c.slice(0, 2) + c.slice(4) : c);

export async function fetchTastingNotePdf(itemCode: string): Promise<{ bytes: ArrayBuffer; code: string } | null> {
  const idx = await loadNoteIndex();
  if (!idx) return null;
  const pdfCodes = Object.keys(idx.files)
    .filter((n) => n.toLowerCase().endsWith('.pdf'))
    .map((n) => n.replace(/\.pdf$/i, ''));
  const set = new Set(pdfCodes);
  let code: string | null = set.has(itemCode) ? itemCode : null;
  if (!code) {
    const base = vintageBaseOf(itemCode);
    const candidates = pdfCodes.filter((c) => c !== itemCode && vintageBaseOf(c) === base);
    code = candidates.sort().pop() ?? null; // 같은 와인이면 품번(빈티지) 큰 쪽 우선
  }
  if (!code) return null;
  const url = idx.files[`${code}.pdf`];
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return { bytes: await res.arrayBuffer(), code };
}
