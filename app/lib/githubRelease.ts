// GitHub Release 파일 업로드 유틸리티
// 기존 "Tasting note" 릴리스(tag: note)에 파일을 추가/덮어쓰기

import { logger } from "@/app/lib/logger";

const REPO_OWNER = "chanbap24-create";
const REPO_NAME = "order_ai";
const RELEASE_TAG = "note";
const INDEX_FILE = "tasting-notes-index.json";

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN 환경변수가 설정되지 않았습니다.");
  return token;
}

function apiHeaders(token: string) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "order-ai",
  };
}

/** 기존 릴리스 가져오기 (없으면 에러) */
async function getRelease(): Promise<{ id: number; upload_url: string }> {
  const token = getToken();
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const res = await fetch(`${base}/releases/tags/${RELEASE_TAG}`, { headers: apiHeaders(token) });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`기존 릴리스(tag: ${RELEASE_TAG})를 찾을 수 없습니다: ${res.status} ${err}`);
  }

  const data = await res.json();
  logger.info(`[GitHub] Release found: "${data.name}" (id=${data.id})`);
  return { id: data.id, upload_url: data.upload_url };
}

/** 릴리스의 모든 에셋 목록 가져오기 */
async function getReleaseAssets(releaseId: number): Promise<any[]> {
  const token = getToken();
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const allAssets: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${base}/releases/${releaseId}/assets?per_page=100&page=${page}`, {
      headers: apiHeaders(token),
    });
    if (!res.ok) break;
    const assets = await res.json();
    if (!assets.length) break;
    allAssets.push(...assets);
    if (assets.length < 100) break;
    page++;
  }
  return allAssets;
}

/** 기존 에셋 삭제 (같은 이름) */
async function deleteExistingAsset(releaseId: number, fileName: string) {
  const token = getToken();
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const res = await fetch(`${base}/releases/${releaseId}/assets?per_page=100`, { headers: apiHeaders(token) });
  if (!res.ok) return;

  const assets = await res.json();
  for (const asset of assets) {
    if (asset.name === fileName) {
      await fetch(`${base}/releases/assets/${asset.id}`, {
        method: "DELETE",
        headers: apiHeaders(token),
      });
      logger.info(`[GitHub] Deleted existing asset: ${fileName}`);
    }
  }
}

/** 파일을 GitHub 릴리스에 업로드 */
export async function uploadToRelease(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
  logger.info(`[GitHub] Starting upload: ${fileName} (${buffer.length} bytes)`);

  const release = await getRelease();

  // 같은 이름 파일 있으면 삭제 (덮어쓰기)
  await deleteExistingAsset(release.id, fileName);

  // 업로드 URL 생성
  const uploadUrl = release.upload_url.replace("{?name,label}", `?name=${encodeURIComponent(fileName)}`);

  const token = getToken();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": contentType,
      "User-Agent": "order-ai",
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub 에셋 업로드 실패: ${res.status} ${err}`);
  }

  const data = await res.json();
  logger.info(`[GitHub] Uploaded: ${fileName} (${buffer.length} bytes)`);
  return data.browser_download_url;
}

/**
 * GitHub Release의 모든 PDF 에셋을 스캔하여
 * tasting-notes-index.json을 자동 생성 및 업로드
 */
export async function refreshReleaseIndex(): Promise<{ total: number }> {
  logger.info(`[GitHub] Refreshing tasting-notes-index.json...`);

  const release = await getRelease();
  const assets = await getReleaseAssets(release.id);

  // PDF 파일만 인덱스
  const notes: Record<string, any> = {};
  for (const asset of assets) {
    if (asset.name.toLowerCase().endsWith('.pdf') && asset.name !== INDEX_FILE) {
      const itemNo = asset.name.replace('.pdf', '');
      notes[itemNo] = {
        exists: true,
        filename: asset.name,
        size_kb: Math.round(asset.size / 1024),
        pages: 1,
        wine_name: "",
      };
    }
  }

  const index = {
    version: "1.0",
    updated_at: new Date().toISOString().split('T')[0],
    base_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}`,
    notes,
  };

  const indexBuffer = Buffer.from(JSON.stringify(index, null, 2), 'utf-8');

  // 기존 인덱스 삭제 후 업로드
  await deleteExistingAsset(release.id, INDEX_FILE);

  const uploadUrl = release.upload_url.replace("{?name,label}", `?name=${encodeURIComponent(INDEX_FILE)}`);
  const token = getToken();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "order-ai",
    },
    body: indexBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`인덱스 업로드 실패: ${res.status} ${err}`);
  }

  logger.info(`[GitHub] Index updated: ${Object.keys(notes).length} items`);
  return { total: Object.keys(notes).length };
}
