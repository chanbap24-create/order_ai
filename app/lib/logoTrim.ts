import sharp from "sharp";

/**
 * 로고 등 이미지의 흰/투명 여백을 잘라 '내용 경계'로 크롭.
 * sharp.trim()이 미세 노이즈로 실패하는 케이스가 있어, 비백색 픽셀의 경계상자를 직접 계산한다.
 * (예: 가로 워드마크가 정사각 캔버스 중앙에 있고 상하 여백이 큰 로고 → 여백 제거 후 꽉 차게)
 *
 * @returns 크롭된 PNG base64 + 새 픽셀 크기. 실패 시 null.
 */
export async function trimWhitespace(
  base64: string,
): Promise<{ base64: string; w: number; h: number } | null> {
  try {
    const src = Buffer.from(base64, "base64");
    // 경계 계산은 흰 배경으로 평탄화한 픽셀에서 (투명 영역도 여백으로 간주)
    const { data, info } = await sharp(src)
      .flatten({ background: "#ffffff" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;

    const TH = 235; // 이보다 어두운 픽셀 = 내용
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * C;
        if (data[i] < TH || data[i + 1] < TH || data[i + 2] < TH) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // 내용 없음

    const pad = Math.max(2, Math.round(Math.min(W, H) * 0.02));
    const left = Math.max(0, minX - pad);
    const top = Math.max(0, minY - pad);
    const w = Math.min(W - left, maxX - minX + 1 + pad * 2);
    const h = Math.min(H - top, maxY - minY + 1 + pad * 2);

    // 여백 제거가 거의 없으면(이미 꽉 찬 로고) 원본 그대로
    if (w >= W * 0.96 && h >= H * 0.96) return null;

    // 출력은 원본에서 크롭(투명 보존)
    const out = await sharp(src).extract({ left, top, width: w, height: h }).png().toBuffer();
    return { base64: out.toString("base64"), w, h };
  } catch {
    return null;
  }
}
