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
import sharp from 'sharp';
import { imageSize } from 'image-size';
import { supabase } from '@/app/lib/db';
import { IMAGE_CELL_PX } from './types';

const BOTTLE_IMG_DIR = path.join(process.cwd(), 'public', 'bottle-images');

// 견적서 이미지 정규화 — 병 bbox 를 직접 찾아 잘라낸 뒤 셀 비율 캔버스에 중앙 합성.
// 캔버스 비율 = 이미지 셀 비율(IMAGE_CELL_PX) 이어야 twoCell(셀 채움) 시 왜곡이 없다.
// sharp.trim 은 희미한 잔여 픽셀(jpeg 아티팩트/그림자)을 남겨 병이 쏠리므로 bbox 직접 검출.
const NORM_W = 300;
const NORM_H = Math.round(NORM_W * (IMAGE_CELL_PX.h / IMAGE_CELL_PX.w)); // 셀 비율 = 캔버스 비율
const WHITE = { r: 255, g: 255, b: 255 };

async function normalizeForExcel(buffer: Buffer): Promise<PreloadedImage | null> {
  try {
    // EXIF 방향 적용한 기준 버퍼(분석·추출 좌표 일치)
    const oriented = await sharp(buffer).rotate().toBuffer();
    const { data, info } = await sharp(oriented)
      .flatten({ background: WHITE })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;

    const TH = 25; // 흰색과의 차이 임계 (이하면 배경)
    const col = new Array(W).fill(0);
    const row = new Array(H).fill(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * C;
        if (255 - Math.min(data[i], data[i + 1], data[i + 2]) > TH) {
          col[x]++;
          row[y]++;
        }
      }
    }
    // 잡티 무시: 한 줄에 최소 내용픽셀 있어야 경계로 인정
    const minCol = Math.max(3, Math.floor(H * 0.02));
    const minRow = Math.max(3, Math.floor(W * 0.02));
    let x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1;
    while (x0 < W && col[x0] < minCol) x0++;
    while (x1 > x0 && col[x1] < minCol) x1--;
    while (y0 < H && row[y0] < minRow) y0++;
    while (y1 > y0 && row[y1] < minRow) y1--;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    if (cw < 5 || ch < 5) return null; // 내용 없음

    const crop = await sharp(oriented).extract({ left: x0, top: y0, width: cw, height: ch }).toBuffer();
    // 캔버스의 82%로 배치 → 셀을 채워도 병 사방(특히 상하)에 여백 확보
    const PAD = 0.82;
    // 병을 살짝 통통하게(가로만 1.15배). 너무 얇은 병 보정 — 캔버스 폭은 초과하지 않게 cap.
    const FATTEN = 1.15;
    const scale = Math.min((NORM_W * PAD) / cw, (NORM_H * PAD) / ch);
    const w = Math.max(1, Math.min(NORM_W, Math.round(cw * scale * FATTEN)));
    const h = Math.max(1, Math.round(ch * scale));
    const resized = await sharp(crop).resize(w, h).toBuffer();

    const out = await sharp({
      create: { width: NORM_W, height: NORM_H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    })
      .composite([{ input: resized, gravity: 'centre' }])
      .png()
      .toBuffer();
    return { buffer: out, width: NORM_W, height: NORM_H, ext: 'png' };
  } catch {
    return null; // 실패 시 원본 유지
  }
}

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

  // 모든 이미지를 동일 비율(3:4)로 정규화 → 견적서에서 크기·정렬 통일
  await Promise.all(
    [...result.entries()].map(async ([code, img]) => {
      const norm = await normalizeForExcel(img.buffer);
      if (norm) result.set(code, norm);
    }),
  );

  return result;
}
