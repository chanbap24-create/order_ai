// GitHub Actions 워크플로우 수동 실행 (workflow_dispatch)
import { NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

const REPO_OWNER = "chanbap24-create";
const REPO_NAME = "order_ai";
const WORKFLOW_FILE = "update-tasting-notes-index.yml";

export async function POST() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json({ success: false, error: "GITHUB_TOKEN이 설정되지 않았습니다." }, { status: 400 });
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "order-ai",
      },
      body: JSON.stringify({ ref: "main" }),
    });

    if (res.status === 204) {
      logger.info("[GitHub] Workflow dispatched: update-tasting-notes-index");
      return NextResponse.json({ success: true });
    }

    const err = await res.text();
    logger.warn(`[GitHub] Workflow dispatch failed: ${res.status} ${err}`);
    return NextResponse.json({ success: false, error: `${res.status}: ${err}` }, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[GitHub Dispatch] ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
