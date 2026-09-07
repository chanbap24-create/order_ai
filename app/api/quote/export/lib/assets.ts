import fs from 'fs';
import path from 'path';
import { loadNoteIndex } from '@/app/lib/noteStore';

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
let cachedIndex: { data: Map<string, string>; expiresAt: number } | null = null;

/** 품번 → PDF URL (Storage 인덱스 — 레거시 GitHub + Storage 통합) */
export async function loadTastingNoteIndex(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedIndex && cachedIndex.expiresAt > now) {
    return cachedIndex.data;
  }
  try {
    const idx = await loadNoteIndex();
    const m = new Map<string, string>();
    for (const [name, url] of Object.entries(idx?.files || {})) {
      if (name.toLowerCase().endsWith('.pdf')) m.set(name.replace(/\.pdf$/i, ''), url);
    }
    cachedIndex = { data: m, expiresAt: now + INDEX_TTL_MS };
    return m;
  } catch {
    // 오류 시 이전 캐시라도 있으면 재사용 (stale-while-fail)
    if (cachedIndex) return cachedIndex.data;
    return new Map();
  }
}
