import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { safeFetch } from "@/app/lib/ssrfGuard";

// sharp/dns 사용 — Node 런타임 강제
export const runtime = "nodejs";

const BUCKET = "brand-logos";

/** website URL → 도메인(www 제거). 실패 시 "". */
function domainFromWebsite(website?: string): string {
  if (!website) return "";
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 홈페이지 HTML에서 apple-touch-icon(깔끔한 정사각 로고) 우선 추출. */
async function scrapeHomepageLogo(site: string): Promise<string | null> {
  try {
    const base = site.startsWith("http") ? site : `https://${site}`;
    // SSRF 방어: 사용자 제공 사이트 → 공인 주소만 허용
    const r = await safeFetch(base, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const head = (await r.text()).slice(0, 50000);
    const pick = (re: RegExp) => head.match(re)?.[1] || null;
    const href =
      pick(/<link[^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]+href=["']([^"']+)["']/i) ||
      pick(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["']/i) ||
      pick(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+\.png[^"']*)["']/i);
    if (!href) return null;
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** 이미지 다운로드(image/* 만). 실패 시 null. */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    // SSRF 방어: 스크래핑으로 얻은 href 등 임의 URL → 공인 주소만 허용
    const r = await safeFetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** 버킷이 없으면 생성(공개). 이미 있으면 무시. */
async function ensureBucket() {
  try {
    await supabase.storage.createBucket(BUCKET, { public: true });
  } catch {
    /* already exists or no permission */
  }
}

/**
 * POST /api/admin/brands/logo — 공식 웹사이트에서 로고 추출 → 스토리지에 저장 → 안정 URL 반환.
 * 1) 홈페이지 apple-touch-icon  2) Clearbit  3) 파비콘(저화질 fallback).
 */
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  // 멀티파트 = 파일 직접 업로드
  if (ct.includes("multipart/form-data")) {
    return handleUpload(req);
  }

  // JSON = 웹사이트 기반 로고 추출
  let website = "";
  try {
    ({ website } = await req.json());
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const domain = domainFromWebsite(website);
  if (!domain) {
    return NextResponse.json({ error: "유효한 웹사이트 URL이 필요합니다" }, { status: 400 });
  }

  // 후보 순서대로 다운로드 시도
  const scraped = await scrapeHomepageLogo(website);
  const candidates = [scraped, `https://logo.clearbit.com/${domain}`].filter(Boolean) as string[];
  let buf: Buffer | null = null;
  for (const url of candidates) {
    const b = await downloadImage(url);
    if (b && b.length > 700) { buf = b; break; }
  }
  let usedFavicon = false;
  if (!buf) {
    buf = await downloadImage(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
    usedFavicon = true;
  }
  if (!buf) {
    return NextResponse.json({ error: "로고를 찾지 못했습니다 (웹사이트 접근 불가)" }, { status: 404 });
  }

  // PNG 정규화(투명 배경 보존)
  let png: Buffer;
  try {
    png = await sharp(buf).png().toBuffer();
  } catch {
    png = buf;
  }

  // 스토리지 저장(핫링크/소실 방지)
  await ensureBucket();
  const path = `${domain.replace(/[^a-z0-9.-]/gi, "_")}.png`;
  let upErr = (await supabase.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true })).error;
  if (upErr) {
    // 버킷 미존재일 수 있으니 한 번 더 시도
    await ensureBucket();
    upErr = (await supabase.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true })).error;
  }
  if (upErr) {
    logger.warn(`[BrandLogo] storage upload failed: ${upErr.message}`);
    return NextResponse.json({ error: `스토리지 저장 실패: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const logo_url = `${pub.publicUrl}?v=${Date.now()}`; // 덮어쓰기 캐시 무효화
  logger.info(`[BrandLogo] saved logo for ${domain}${usedFavicon ? " (favicon)" : ""}`);
  return NextResponse.json({
    logo_url,
    warning: usedFavicon ? "고화질 로고를 찾지 못해 파비콘을 저장했습니다 (저화질, 교체 권장)" : undefined,
  });
}

/** 파일 직접 업로드 → 스토리지 저장 → 공개 URL 반환. FormData: file, kind(logo|image), key. */
async function handleUpload(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 업로드 요청" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = (form.get("kind") as string) === "image" ? "image" : "logo";
  const rawKey = ((form.get("key") as string) || "brand").toLowerCase();
  const key = rawKey.replace(/[^a-z0-9.-]/g, "_").slice(0, 60) || "brand";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "파일이 너무 큽니다 (최대 5MB)" }, { status: 400 });
  }

  const inBuf = Buffer.from(await file.arrayBuffer());
  // SVG는 원본 유지, 그 외 래스터는 PNG로 정규화(투명 보존 + PDF 호환)
  let outBuf = inBuf;
  let ext = "png";
  let contentType = "image/png";
  if (file.type === "image/svg+xml") {
    ext = "svg";
    contentType = "image/svg+xml";
  } else {
    try {
      outBuf = await sharp(inBuf).png().toBuffer();
    } catch {
      outBuf = inBuf;
      contentType = file.type;
      ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
    }
  }

  await ensureBucket();
  const path = `${kind}-${key}.${ext}`;
  let upErr = (await supabase.storage.from(BUCKET).upload(path, outBuf, { contentType, upsert: true })).error;
  if (upErr) {
    await ensureBucket();
    upErr = (await supabase.storage.from(BUCKET).upload(path, outBuf, { contentType, upsert: true })).error;
  }
  if (upErr) {
    logger.warn(`[BrandLogo] file upload failed: ${upErr.message}`);
    return NextResponse.json({ error: `스토리지 저장 실패: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  logger.info(`[BrandLogo] uploaded ${kind} file → ${path}`);
  return NextResponse.json({ url, kind });
}
