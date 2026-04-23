import fs from 'fs';
import path from 'path';
import { supabase } from '@/app/lib/db';

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

const BOTTLE_IMG_DIR = path.join(process.cwd(), 'public', 'bottle-images');

export async function getBottleImagePath(itemCode: string): Promise<string | null> {
  try {
    const { data: row } = await supabase
      .from('bottle_images')
      .select('filename')
      .eq('item_code', itemCode)
      .maybeSingle();
    if (row?.filename) {
      const p = path.join(BOTTLE_IMG_DIR, row.filename);
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  for (const ext of ['png', 'jpg', 'jpeg', 'tiff']) {
    const p = path.join(BOTTLE_IMG_DIR, `${itemCode}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function getBottleImageMeta(itemCode: string): Promise<{ width: number; height: number } | null> {
  try {
    const { data: meta } = await supabase
      .from('bottle_images')
      .select('width, height')
      .eq('item_code', itemCode)
      .maybeSingle();
    if (meta?.width && meta?.height) return { width: meta.width, height: meta.height };
  } catch {}
  return null;
}

export async function loadTastingNoteIndex(): Promise<Set<string>> {
  try {
    const res = await fetch(`${TASTING_NOTE_INDEX_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const s = new Set<string>();
    for (const [k, v] of Object.entries(data.notes || {} as Record<string, unknown>)) {
      if ((v as { exists?: boolean })?.exists) s.add(k);
    }
    return s;
  } catch {
    return new Set();
  }
}
