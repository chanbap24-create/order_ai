// GitHub Release 파일 업로드 유틸리티
// 기존 "Tasting note" 릴리스(tag: note)에 파일을 추가/덮어쓰기

import { logger } from "@/app/lib/logger";

const REPO_OWNER = "chanbap24-create";
const REPO_NAME = "order_ai";
const RELEASE_TAG = "note";

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN 환경변수가 설정되지 않았습니다.");
  return token;
}

function headers(token: string) {
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

  const res = await fetch(`${base}/releases/tags/${RELEASE_TAG}`, { headers: headers(token) });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`기존 릴리스(tag: ${RELEASE_TAG})를 찾을 수 없습니다: ${res.status} ${err}`);
  }

  const data = await res.json();
  logger.info(`[GitHub] Release found: "${data.name}" (id=${data.id})`);
  return { id: data.id, upload_url: data.upload_url };
}

/** 기존 에셋 삭제 (같은 이름) */
async function deleteExistingAsset(releaseId: number, fileName: string) {
  const token = getToken();
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const res = await fetch(`${base}/releases/${releaseId}/assets`, { headers: headers(token) });
  if (!res.ok) return;

  const assets = await res.json();
  for (const asset of assets) {
    if (asset.name === fileName) {
      await fetch(`${base}/releases/assets/${asset.id}`, {
        method: "DELETE",
        headers: headers(token),
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
