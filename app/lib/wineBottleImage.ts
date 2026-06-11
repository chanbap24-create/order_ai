// PPTX 노트의 와인병 이미지를 추출해 Supabase Storage 에 올리고 wines.image_url 을 채운다.
// 라우트(앱 supabase)와 배치 스크립트(자체 client) 모두 재사용하도록 client 를 인자로 받음.
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractBottleImageFromPptx } from "./tastingNotePptxParse";

const BUCKET = "wine-bottles";

/**
 * image_url 이 비어 있을 때만 PPTX 병 이미지를 추출·업로드해 wines.image_url 설정.
 * 반환: 새로 채운 public URL, 채울 게 없으면 null.
 */
export async function syncBottleImageIfEmpty(
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
  if (wine.image_url && String(wine.image_url).trim() !== "") return null; // 빈 칸만

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
