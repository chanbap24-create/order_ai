import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "GET method works",
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    success: true,
    message: "POST method works",
    receivedData: body,
    timestamp: new Date().toISOString()
  });
}
