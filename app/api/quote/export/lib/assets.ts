import fs from 'fs';
import path from 'path';

export const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const TASTING_NOTE_INDEX_URL = `${TASTING_NOTE_BASE_URL}/tasting-notes-index.json`;

export function getLogoPath(company: string): string | null {
  const filename = company === 'DL' ? 'riedel.png' : 'cavedevin.png';
  const candidates = [
    path.join(process.cwd(), 'public', 'logos', filename),
    path.join(process.cwd(), 'logos', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * tasting-notes-index.json 메모리 캐시.
 *
 * GitHub Releases 에 호스팅된 인덱스로, 매 견적서 export 마다 ~300~800ms 네트워크
 * 왕복을 소모했음. 인덱스는 릴리스 업데이트 시에만 변경되므로 60초 TTL 로 충분.
 *
 * Fluid Compute 인스턴스 재사용 시 같은 프로세스 내에서 재활용됨.
 * 콜드 스타트엔 어차피 fetch 1회는 필수.
 */
const INDEX_TTL_MS = 60_000;
let cachedIndex: { data: Set<string>; expiresAt: number } | null = null;

export async function loadTastingNoteIndex(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedIndex && cachedIndex.expiresAt > now) {
    return cachedIndex.data;
  }
  try {
    const res = await fetch(`${TASTING_NOTE_INDEX_URL}?t=${now}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const s = new Set<string>();
    for (const [k, v] of Object.entries(data.notes || {} as Record<string, unknown>)) {
      if ((v as { exists?: boolean })?.exists) s.add(k);
    }
    cachedIndex = { data: s, expiresAt: now + INDEX_TTL_MS };
    return s;
  } catch {
    // 네트워크 오류 시 이전 캐시라도 있으면 재사용 (stale-while-fail)
    if (cachedIndex) return cachedIndex.data;
    return new Set();
  }
}
