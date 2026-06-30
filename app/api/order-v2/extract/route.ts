import { NextRequest, NextResponse } from "next/server";
import { extractOrderFromImage } from "@/app/lib/orderIntake";
import { getManagerClients } from "@/app/lib/orderClients";
import { getSession } from "@/app/lib/auth";

export const runtime = "nodejs";

const ALLOWED_MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // base64 디코드 기준 약 8MB

// POST: 카톡 스크린샷(base64) → { client_hint, order_text }
export async function POST(req: NextRequest) {
  try {
    const { image_data, media_type, tab } = await req.json();

    if (typeof image_data !== "string" || !image_data) {
      return NextResponse.json({ error: "이미지 데이터가 없습니다." }, { status: 400 });
    }
    if (typeof media_type !== "string" || !ALLOWED_MEDIA.has(media_type)) {
      return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다. (png/jpg/webp/gif)" }, { status: 400 });
    }
    // base64 길이로 대략적 바이트 추정 (4글자 = 3바이트)
    if ((image_data.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "이미지가 너무 큽니다. (최대 8MB)" }, { status: 400 });
    }

    // 로그인 담당자의 거래처 목록을 주면 LLM이 거래처 코드까지 직접 고른다(미로그인 시 기존 동작).
    const session = await getSession();
    const clients = session?.manager
      ? await getManagerClients(session.manager, tab === "DL" ? "DL" : "CDV")
      : [];

    const result = await extractOrderFromImage(image_data, media_type, clients);
    if (!result.found) {
      return NextResponse.json(
        { ...result, error: "스크린샷에서 발주 내용을 찾지 못했습니다. 발주 메시지가 잘 보이게 다시 찍어주세요." },
        { status: 200 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("order-v2 extract error:", error);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "이미지 분석 중 오류가 발생했습니다.",
        ...(isDev ? { detail: String(error) } : {}),
      },
      { status: 500 },
    );
  }
}
