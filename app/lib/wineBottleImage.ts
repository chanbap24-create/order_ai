// PPTX 노트의 와인병 이미지를 추출해 Supabase Storage 에 올리고 wines.image_url 을 채운다.
// 라우트(앱 supabase)와 배치 스크립트(자체 client) 모두 재사용하도록 client 를 인자로 받음.
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractBottleImageFromPptx } from "./tastingNotePptxParse";
import { downloadImageAsBase64 } from "./wineImageSearch";

const BUCKET = "wine-bottles";

/**
 * 외부 이미지 URL을 Supabase Storage에 미리 다운로드·재호스팅해 '항상 서버에서 가져올 수 있는'
 * public URL로 바꾼다. (사용자가 준 URL을 저장 시점에 받아두고 그때그때 쓰는 방식)
 * - data URL / 이미 우리 storage URL이면 그대로 반환
 * - 다운로드 실패(핫링크·WAF 차단 등 서버 접근 불가)면 원본 URL 유지 → 생성 시 검색 폴백이 담당
 */
export async function rehostImageUrl(sb: SupabaseClient, itemCode: string, url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  if (url.includes(`/storage/v1/object/public/${BUCKET}/`)) return url; // 이미 재호스팅됨
  const img = await downloadImageAsBase64(url).catch(() => null);
  if (!img) return url; // 서버가 못 가져오면(WAF 등) 원본 유지
  try { await sb.storage.createBucket(BUCKET, { public: true }); } catch { /* 이미 존재 */ }
  const ext = (img.mimeType.split("/")[1] || "png").split("+")[0].replace("jpeg", "jpg");
  const path = `${itemCode}-manual.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(img.base64, "base64"), {
    contentType: img.mimeType,
    upsert: true,
  });
  if (up.error) return url;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

/** 교체 대상 "불량" 이미지 소스 — wine-searcher 라벨(가로 워터마크 크롭). */
export function isBadImageUrl(url?: string | null): boolean {
  return !!url && /wine-searcher/i.test(url);
}

/**
 * image_url 이 비어 있거나 불량 소스(wine-searcher)일 때 PPTX 병 이미지로 채움/교체.
 * 반환: 새로 채운 public URL, 채울 게 없으면 null.
 */
export async function syncBottleImage(
  sb: SupabaseClient,
  itemCode: string,
  pptxBuffer: Buffer,
): Promise<string | null> {
  const { data: wine } = await sb
    .from("wines")
    .select("image_url")
    .eq("item_code", itemCode)
    .maybeSingle();
  if (!wine) return null; // 와인 행 없음
  const cur = wine.image_url ? String(wine.image_url).trim() : "";
  if (cur !== "" && !isBadImageUrl(cur)) return null; // 빈 칸 또는 불량(wine-searcher)일 때만

  const bottle = await extractBottleImageFromPptx(pptxBuffer);
  if (!bottle) return null;

  try {
    await sb.storage.createBucket(BUCKET, { public: true });
  } catch {
    /* 이미 존재 */
  }

  const path = `${itemCode}.${bottle.ext}`;
  const bytes = Buffer.from(bottle.base64, "base64");
  const up = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: bottle.mime, upsert: true });
  if (up.error) return null;

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  await sb
    .from("wines")
    .update({ image_url: url, updated_at: new Date().toISOString() })
    .eq("item_code", itemCode);
  return url;
}
