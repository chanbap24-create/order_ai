// 단일 와인의 테이스팅 노트 PPTX/PDF를 재생성해 GitHub Release에 재업로드.
// 이미지 URL 변경 등으로 노트 자산을 최신화할 때 사용. 노트가 없는 와인은 스킵.
import { NextRequest, NextResponse } from "next/server";
import { generateSingleWinePpt } from "@/app/lib/pptGenerator";
import { generateSingleWinePdf } from "@/app/lib/pdfGenerator";
import { uploadToRelease, refreshReleaseIndex } from "@/app/lib/githubRelease";
import { getTastingNote, upsertTastingNote } from "@/app/lib/wineDb";
import { logger } from "@/app/lib/logger";

export const maxDuration = 300;

const PPTX_CT = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ success: false, error: "GITHUB_TOKEN 환경변수가 설정되지 않았습니다." }, { status: 400 });
    }
    const { wineId } = await request.json();
    const code = wineId ? String(wineId) : "";
    if (!code) return NextResponse.json({ success: false, error: "wineId가 필요합니다." }, { status: 400 });

    // 노트가 있는 와인만 재업로드(재업로드 = 기존 자산 최신화)
    const note = await getTastingNote(code);
    if (!note) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_tasting_note" });
    }

    // 최신 image_url을 반영해 PPTX/PDF 재생성(네이티브 — libreoffice 불필요)
    const [pptBuffer, pdfBuffer] = await Promise.all([
      generateSingleWinePpt(code),
      generateSingleWinePdf(code),
    ]);

    // GitHub Release에 {code}.pptx / {code}.pdf 로 덮어쓰기
    await uploadToRelease(`${code}.pptx`, pptBuffer, PPTX_CT);
    await uploadToRelease(`${code}.pdf`, pdfBuffer, "application/pdf");
    await refreshReleaseIndex().catch(() => null); // PDF 인덱스 갱신(실패해도 무시)
    await upsertTastingNote(code, { ppt_generated: 1 }).catch(() => null);

    logger.info(`[Regenerate] Re-uploaded pptx+pdf for ${code}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[Regenerate] failed`, { error: e });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
