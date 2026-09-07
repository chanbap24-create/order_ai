// 테이스팅 노트 파일(PDF·PPTX) 저장소 — Supabase Storage(tasting-notes 버킷).
//
// 배경: 기존 저장소였던 GitHub 릴리즈(note 태그)는 릴리즈당 자산 1,000개 하드 리밋에
// 도달해 신규 업로드가 422로 거부됨(2026-09). 신규 업로드는 전부 Storage로,
// 기존 자산은 GitHub URL 그대로 유효 — 인덱스(index.json)가 파일별 URL을 들고
// 양쪽을 통합한다. 소비처는 반드시 이 인덱스로 URL을 해석할 것 (고정 베이스 URL 조립 금지).
import { supabase } from './db';
import { listReleaseAssetNames } from './githubRelease';
import { logger } from './logger';

const BUCKET = 'tasting-notes';
const INDEX_PATH = 'index.json';
const LEGACY_BASE = 'https://github.com/chanbap24-create/order_ai/releases/download/note';

export type NoteIndex = {
  version: 2;
  updated_at: string;
  /** 파일명(예: "0016001.pdf") → 다운로드 URL. Storage 우선, 없으면 레거시 GitHub. */
  files: Record<string, string>;
  /** 구버전 호환: 품번 → { exists } (PDF 기준) */
  notes: Record<string, { exists: boolean }>;
};

/** 파일 업로드 → 공개 URL 반환 (동명 파일은 덮어씀) */
export async function uploadNote(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET)
    .upload(fileName, buffer, { contentType, upsert: true });
  if (error) throw new Error(`노트 업로드 실패(${fileName}): ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  logger.info(`[NoteStore] Uploaded ${fileName} (${buffer.length}b)`);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Storage의 노트 파일 전체 나열 (인덱스 제외) */
async function listStorageNotes(): Promise<{ name: string }[]> {
  const out: { name: string }[] = [];
  let offset = 0;
  // Storage list는 기본 100개 — 페이지네이션
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Storage 목록 실패: ${error.message}`);
    const rows = (data || []).filter((f) => f.name !== INDEX_PATH);
    out.push(...rows);
    if (!data || data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

/** 인덱스 재생성: GitHub 레거시 + Storage 통합 → Storage에 index.json 저장. Storage가 우선. */
export async function refreshNoteIndex(): Promise<{ total: number; storage: number; legacy: number }> {
  const files: Record<string, string> = {};

  // 1) 레거시 GitHub 자산 (기존 ~1,000개)
  let legacyCount = 0;
  try {
    const legacy = await listReleaseAssetNames();
    for (const name of legacy) {
      if (name === 'tasting-notes-index.json') continue;
      files[name] = `${LEGACY_BASE}/${name}`;
      legacyCount++;
    }
  } catch (e) {
    logger.warn(`[NoteStore] 레거시 목록 실패(무시): ${e instanceof Error ? e.message : e}`);
  }

  // 2) Storage 파일 — 같은 이름이면 Storage가 우선 (최신 재발행본)
  const stored = await listStorageNotes();
  for (const f of stored) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(f.name);
    files[f.name] = data.publicUrl;
  }

  const notes: Record<string, { exists: boolean }> = {};
  for (const name of Object.keys(files)) {
    if (name.toLowerCase().endsWith('.pdf')) notes[name.replace(/\.pdf$/i, '')] = { exists: true };
  }

  const index: NoteIndex = {
    version: 2,
    updated_at: new Date().toISOString(),
    files,
    notes,
  };
  const buf = Buffer.from(JSON.stringify(index), 'utf-8');
  const { error } = await supabase.storage.from(BUCKET)
    .upload(INDEX_PATH, buf, { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`인덱스 저장 실패: ${error.message}`);
  logger.info(`[NoteStore] Index refreshed: ${Object.keys(files).length} files (storage ${stored.length} / legacy ${legacyCount})`);
  return { total: Object.keys(notes).length, storage: stored.length, legacy: legacyCount };
}

/** 인덱스 로드 (서버 측 공용) — 실패 시 null */
export async function loadNoteIndex(): Promise<NoteIndex | null> {
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(INDEX_PATH);
    const res = await fetch(`${data.publicUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const idx = await res.json();
    if (!idx?.files) return null;
    return idx as NoteIndex;
  } catch {
    return null;
  }
}

/** 품번 → PDF URL (없으면 null). 같은 와인 다른 빈티지 폴백은 호출부에서. */
export function noteUrlOf(index: NoteIndex | null, code: string, ext: 'pdf' | 'pptx' = 'pdf'): string | null {
  return index?.files?.[`${code}.${ext}`] ?? null;
}
