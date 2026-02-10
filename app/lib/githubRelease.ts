// GitHub Release 파일 업로드 유틸리티

import { logger } from "@/app/lib/logger";

const REPO_OWNER = "chanbap24-create";
const REPO_NAME = "order_ai";
const RELEASE_TAG = "tasting-notes";

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

/** 릴리스 가져오기 (없으면 생성) */
async function getOrCreateRelease(): Promise<{ id: number; upload_url: string }> {
  const token = getToken();
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  // 기존 릴리스 찾기
  const res = await fetch(`${base}/releases/tags/${RELEASE_TAG}`, { headers: headers(token) });

  if (res.ok) {
    const data = await res.json();
    return { id: data.id, upload_url: data.upload_url };
  }

  // 없으면 생성
  const createRes = await fetch(`${base}/releases`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: RELEASE_TAG,
      name: "Tasting Notes",
      body: "AI 와인 조사 결과 - 테이스팅 노트 파일",
      draft: false,
      prerelease: false,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`GitHub 릴리스 생성 실패: ${createRes.status} ${err}`);
  }

  const data = await createRes.json();
  logger.info(`[GitHub] Release created: ${RELEASE_TAG}`);
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
  const release = await getOrCreateRelease();

  // 기존 파일 삭제
  await deleteExistingAsset(release.id, fileName);

  // 업로드 URL 생성
  const uploadUrl = release.upload_url.replace("{?name,label}", `?name=${encodeURIComponent(fileName)}`);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `token ${getToken()}`,
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
