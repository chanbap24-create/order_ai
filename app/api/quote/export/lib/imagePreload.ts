/**
 * 병(bottle) 이미지 일괄 prefetch.
 *
 * 기존 구현은 아이템당 Supabase SELECT 2회 + 동기 fs.readFileSync.
 * 수십 개 견적 시 DB RTT 누적 + 이벤트 루프 블록으로 큰 지연 발생.
 *
 * 이 모듈은:
 *  1) bottle_images 테이블에서 item_codes 일괄 조회 (1회 DB 왕복)
 *  2) 파일 경로 해석 (DB filename → 실패 시 확장자 fallback)
 *  3) fs.promises.readFile 로 모든 이미지 병렬 읽기 (Promise.all)
 *
 * TIFF 는 ExcelJS 가 지원하지 않으므로 Map 에서 제외 (buildDataRows 에서
 * itemCode 텍스트 폴백 처리).
 */

import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { imageSize } from 'image-size';
import { supabase } from '@/app/lib/db';

const BOTTLE_IMG_DIR = path.join(process.cwd(), 'public', 'bottle-images');

export type PreloadedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  ext: 'png' | 'jpeg' | 'gif';
};

export type BottleImageMap = Map<string, PreloadedImage>;

type MetaRow = {
  item_code: string;
  filename: string | null;
  width: number | null;
  height: number | null;
};

function normalizeExt(raw: string): 'png' | 'jpeg' | 'gif' | 'tiff' | null {
  const e = raw.toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'jpeg';
  if (e === 'png') return 'png';
  if (e === 'gif') return 'gif';
  if (e === 'tif' || e === 'tiff') return 'tiff';
  return null;
}

type ItemWithImage = { item_code?: string; image_url?: string | null };

/**
 * @param itemCodes 와인 병 이미지 fallback (public/bottle-images/*)
 * @param items quote_items 행 — image_url 컬럼이 있으면 HTTP fetch (글라스 Supabase Storage URL 우선)
 */
export async function preloadBottleImages(
  itemCodes: string[],
  items?: ItemWithImage[],
): Promise<BottleImageMap> {
  const result: BottleImageMap = new Map();

  // Phase A: items[].image_url 우선 — HTTP fetch (글라스 Storage URL)
  const urlItems = (items || []).filter(
    (i) => i.item_code && i.image_url && /^https?:\/\//i.test(i.image_url),
  );
  await Promise.all(
    urlItems.map(async (i) => {
      try {
        const res = await fetch(i.image_url as string);
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') || '';
        let ext: 'png' | 'jpeg' | 'gif' = 'png';
        if (ct.includes('jpeg') || (i.image_url as string).toLowerCase().endsWith('.jpeg')) ext = 'jpeg';
        else if (ct.includes('jpg') || (i.image_url as string).toLowerCase().endsWith('.jpg')) ext = 'jpeg';
        else if (ct.includes('gif')) ext = 'gif';
        let width = 1, height = 1;
        try {
          const dim = imageSize(buf);
          if (dim.width && dim.height) { width = dim.width; height = dim.height; }
        } catch { /* keep default */ }
        result.set(i.item_code as string, { buffer: buf, width, height, ext });
      } catch {
        /* swallow — fall through to bottle_images fallback below */
      }
    }),
  );

  if (itemCodes.length === 0) return result;

  // 중복 제거 + 이미 URL 로 로드된 코드는 제외
  const uniq = Array.from(new Set(itemCodes)).filter((c) => !result.has(c));

  // 1) DB 일괄 조회
  const { data: rows } = await supabase
    .from('bottle_images')
    .select('item_code, filename, width, height')
    .in('item_code', uniq);

  const metaByCode = new Map<string, MetaRow>();
  for (const r of (rows || []) as MetaRow[]) {
    metaByCode.set(r.item_code, r);
  }

  // 2) 파일 경로 해석 (existsSync 는 OS 캐시 덕분에 매우 빠름)
  type Spec = {
    itemCode: string;
    abs: string;
    ext: 'png' | 'jpeg' | 'gif';
    width: number;
    height: number;
  };
  const specs: Spec[] = [];

  for (const code of uniq) {
    const meta = metaByCode.get(code);
    let abs: string | null = null;
    let normExt: ReturnType<typeof normalizeExt> = null;

    if (meta?.filename) {
      const p = path.join(BOTTLE_IMG_DIR, meta.filename);
      if (fsSync.existsSync(p)) {
        abs = p;
        normExt = normalizeExt(path.extname(p).replace('.', ''));
      }
    }
    if (!abs) {
      for (const e of ['png', 'jpg', 'jpeg', 'tiff']) {
        const p = path.join(BOTTLE_IMG_DIR, `${code}.${e}`);
        if (fsSync.existsSync(p)) {
          abs = p;
          normExt = normalizeExt(e);
          break;
        }
      }
    }

    if (!abs || !normExt || normExt === 'tiff') continue; // TIFF skip (ExcelJS 미지원)

    specs.push({
      itemCode: code,
      abs,
      ext: normExt,
      width: meta?.width ?? 1,
      height: meta?.height ?? 2,
    });
  }

  // 3) 모든 이미지 병렬 읽기
  const buffers = await Promise.all(
    specs.map(async (s) => {
      try {
        return await fs.readFile(s.abs);
      } catch {
        return null;
      }
    }),
  );

  specs.forEach((s, i) => {
    const buf = buffers[i];
    if (buf) {
      result.set(s.itemCode, {
        buffer: buf,
        width: s.width,
        height: s.height,
        ext: s.ext,
      });
    }
  });

  return result;
}
